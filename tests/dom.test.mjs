import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAndAppend, el } from '../.tmp-tests/src/components/dom.js';

class FakeNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.parentNode = null;
  }
}

class FakeText extends FakeNode {
  constructor(text = '') {
    super(3);
    this.textContent = text;
  }
}

class FakeElement extends FakeNode {
  constructor(tagName = 'div') {
    super(1);
    this.tagName = tagName.toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.className = '';
    this.dataset = {};
    this.listeners = {};
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.style = { cssText: '' };
    this.value = '';
    this.checked = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.selectionDirection = 'none';
  }

  get children() {
    return this.childNodes.filter((child) => child.nodeType === 1);
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get textContent() {
    return this.childNodes.map((child) => child.textContent ?? '').join('');
  }

  set textContent(value) {
    this.replaceChildren(new FakeText(String(value)));
  }

  append(...children) {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  replaceChild(replacement, current) {
    const index = this.childNodes.indexOf(current);
    if (index < 0) {
      return current;
    }

    current.parentNode = null;
    replacement.parentNode = this;
    this.childNodes[index] = replacement;
    return current;
  }

  replaceChildren(...children) {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes = [];
    this.append(...children);
  }

  replaceWith(replacement) {
    const parent = this.parentNode;
    const index = parent?.childNodes.indexOf(this) ?? -1;
    if (!parent || index < 0) {
      return;
    }

    this.parentNode = null;
    replacement.parentNode = parent;
    parent.childNodes[index] = replacement;
  }

  querySelectorAll(selector) {
    if (selector === '[data-scroll-key]') {
      return collectScrollKeyed(this);
    }

    if (selector === 'details[open][data-disclosure-key]') {
      return collectDetails(this, true);
    }

    if (selector === 'details[data-disclosure-key]') {
      return collectDetails(this, false);
    }

    return [];
  }

  getAttributeNames() {
    return Object.keys(this.attributes);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') {
      this.className = String(value);
    }
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(value);
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= new Set();
    this.listeners[type].add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners[type]?.delete(listener);
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ currentTarget: this, target: this });
    }
  }

  focus() {
    document.activeElement = this;
  }

  setSelectionRange(start, end, direction = 'none') {
    this.selectionStart = start;
    this.selectionEnd = end;
    this.selectionDirection = direction;
  }
}

function installDomShim() {
  globalThis.Node = FakeNode;
  globalThis.document = {
    activeElement: null,
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeText(String(text))
  };
}

function collectScrollKeyed(node) {
  const matches = [];

  if (node.dataset?.scrollKey) {
    matches.push(node);
  }

  for (const child of node.children ?? []) {
    matches.push(...collectScrollKeyed(child));
  }

  return matches;
}

function collectDetails(node, openOnly) {
  const matches = [];

  if (
    node.tagName === 'DETAILS' &&
    node.dataset?.disclosureKey &&
    (!openOnly || node.hasAttribute('open') || node.open === true)
  ) {
    matches.push(node);
  }

  for (const child of node.children ?? []) {
    matches.push(...collectDetails(child, openOnly));
  }

  return matches;
}

test('clearAndAppend preserves keyed scroll positions across rerenders', () => {
  installDomShim();
  const oldRoot = el('div');
  const oldQueue = el('div', { dataset: { scrollKey: 'playback-queue:sequence-1' } });
  oldQueue.scrollTop = 240;
  oldQueue.scrollLeft = 12;
  oldRoot.append(oldQueue);
  const parent = el('div');
  parent.append(oldRoot);

  const nextRoot = el('div');
  const nextQueue = el('div', { dataset: { scrollKey: oldQueue.dataset.scrollKey } });
  nextRoot.append(nextQueue);

  clearAndAppend(parent, nextRoot);

  assert.notEqual(parent.children[0], oldRoot);
  assert.equal(parent.children[0], nextRoot);
  assert.equal(nextQueue.scrollTop, 240);
  assert.equal(nextQueue.scrollLeft, 12);
});

test('clearAndAppend preserves open disclosure menus across refresh rerenders', () => {
  installDomShim();
  const oldRoot = el('div');
  const oldMenu = el('details', { dataset: { disclosureKey: 'segment-actions:clip-1' } });
  oldMenu.setAttribute('open', '');
  oldRoot.append(oldMenu);
  const parent = el('div');
  parent.append(oldRoot);

  const nextRoot = el('div');
  const nextMenu = el('details', { dataset: { disclosureKey: oldMenu.dataset.disclosureKey } });
  nextRoot.append(nextMenu);

  clearAndAppend(parent, nextRoot);

  assert.equal(parent.children[0], nextRoot);
  assert.equal(nextMenu.open, true);
});

test('clearAndAppend replaces existing nodes instead of patching them', () => {
  installDomShim();
  const calls = [];
  const oldRoot = el('div');
  const oldButton = el('button', { onClick: () => calls.push('old') }, 'old label');
  oldRoot.append(oldButton);
  const parent = el('div');
  parent.append(oldRoot);

  const nextRoot = el('div');
  const nextButton = el('button', { onClick: () => calls.push('new') }, 'new label');
  nextRoot.append(nextButton);

  clearAndAppend(parent, nextRoot);

  assert.notEqual(parent.children[0], oldRoot);
  assert.equal(parent.children[0], nextRoot);
  assert.equal(nextRoot.children[0], nextButton);
  assert.equal(nextButton.textContent, 'new label');

  nextButton.click();

  assert.deepEqual(calls, ['new']);
});

test('clearAndAppend replaces nodes when patch keys change', () => {
  installDomShim();
  const oldNav = el('nav', { dataset: { patchKey: 'tabbar:home' } });
  oldNav.append(el('button', { className: 'tab is-active' }, '믹스테이프'));
  const parent = el('div');
  parent.append(oldNav);

  const nextNav = el('nav', { dataset: { patchKey: 'tabbar:settings' } });
  nextNav.append(el('button', { className: 'tab is-active' }, '설정'));

  clearAndAppend(parent, nextNav);

  assert.notEqual(parent.children[0], oldNav);
  assert.equal(parent.children[0], nextNav);
  assert.equal(parent.children[0].dataset.patchKey, 'tabbar:settings');
  assert.equal(parent.children[0].children[0].textContent, '설정');
});

test('clearAndAppend replaces nodes when only one side has a scroll key', () => {
  installDomShim();
  const oldScreen = el('div', { dataset: { scrollKey: 'capture-screen' } });
  oldScreen.append(el('button', { onClick: () => {} }, '편집 화면'));
  const parent = el('div');
  parent.append(oldScreen);

  const nextScreen = el('div');
  nextScreen.append(el('section', {}, '믹스테이프 화면'));

  clearAndAppend(parent, nextScreen);

  assert.notEqual(parent.children[0], oldScreen);
  assert.equal(parent.children[0], nextScreen);
  assert.equal(parent.children[0].textContent, '믹스테이프 화면');
});

test('clearAndAppend preserves active keyed select nodes across rerenders', () => {
  installDomShim();
  const oldRoot = el('div');
  const oldSelect = el('select', {
    value: 'second',
    dataset: { persistKey: 'capture-target:first|second' },
  });
  oldSelect.value = 'user-choice';
  oldRoot.append(oldSelect);
  const parent = el('div');
  parent.append(oldRoot);
  document.activeElement = oldSelect;

  const nextRoot = el('div');
  const nextSelect = el('select', {
    value: 'second',
    dataset: { persistKey: oldSelect.dataset.persistKey },
  });
  nextRoot.append(nextSelect);

  clearAndAppend(parent, nextRoot);

  assert.equal(parent.children[0], nextRoot);
  assert.equal(nextRoot.children[0], oldSelect);
  assert.equal(oldSelect.value, 'user-choice');
  assert.equal(document.activeElement, oldSelect);
});

test('clearAndAppend replaces active keyed selects when option identity changes', () => {
  installDomShim();
  const oldRoot = el('div');
  const oldSelect = el('select', {
    value: 'second',
    dataset: { persistKey: 'capture-target:first|second' },
  });
  oldSelect.value = 'user-choice';
  oldRoot.append(oldSelect);
  const parent = el('div');
  parent.append(oldRoot);
  document.activeElement = oldSelect;

  const nextRoot = el('div');
  const nextSelect = el('select', {
    value: 'third',
    dataset: { persistKey: 'capture-target:first|third' },
  });
  nextRoot.append(nextSelect);

  clearAndAppend(parent, nextRoot);

  assert.equal(parent.children[0], nextRoot);
  assert.equal(nextRoot.children[0], nextSelect);
  assert.equal(nextSelect.value, 'third');
});

test('clearAndAppend restores focused input value and caret on a stable key', () => {
  installDomShim();
  const oldRoot = el('div');
  const oldInput = el('input', {
    value: 'stored name',
    dataset: { persistKey: 'rename-mixtape:sequence-1' },
  });
  oldInput.value = 'user draft';
  oldInput.selectionStart = 4;
  oldInput.selectionEnd = 8;
  oldInput.selectionDirection = 'forward';
  oldRoot.append(oldInput);
  const parent = el('div');
  parent.append(oldRoot);
  document.activeElement = oldInput;

  const nextRoot = el('div');
  const nextInput = el('input', {
    value: 'stored name',
    dataset: { persistKey: oldInput.dataset.persistKey },
  });
  nextRoot.append(nextInput);

  clearAndAppend(parent, nextRoot);

  assert.equal(parent.children[0], nextRoot);
  assert.equal(nextRoot.children[0], nextInput);
  assert.notEqual(nextInput, oldInput);
  assert.equal(nextInput.value, 'user draft');
  assert.equal(nextInput.selectionStart, 4);
  assert.equal(nextInput.selectionEnd, 8);
  assert.equal(nextInput.selectionDirection, 'forward');
  assert.equal(document.activeElement, nextInput);
});
