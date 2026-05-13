// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.js';

class FakeNode {
  constructor(text = '') {
    this.children = [];
    this.parentNode = null;
    this.textContent = text;
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }
}

class FakeElement extends FakeNode {
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.className = '';
    this.dataset = {};
    this.innerHTML = '';
    this.listeners = {};
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      }
    };
    this.value = '';
    this.disabled = false;
    this.open = false;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'open') {
      this.open = true;
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'open') {
      this.open = false;
    }
  }

  closest(selector) {
    if (selector !== 'details') {
      return null;
    }

    let current = this;
    while (current) {
      if (current.tagName === 'DETAILS') {
        return current;
      }
      current = current.parentNode;
    }

    return null;
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  keydown(key) {
    let defaultPrevented = false;
    const event = {
      key,
      currentTarget: this,
      target: this,
      preventDefault() {
        defaultPrevented = true;
      },
      stopPropagation() {}
    };
    for (const listener of this.listeners.keydown ?? []) {
      listener(event);
    }
    return { defaultPrevented };
  }
}

function installDomShim() {
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeNode(String(text))
  };
}

function findByAriaLabel(node, label) {
  if (node.attributes?.['aria-label'] === label) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findByAriaLabel(child, label);
    if (found) {
      return found;
    }
  }

  return null;
}

function baseSettings() {
  return {
    accentKey: 'peach',
    language: 'ko',
    autoNext: true,
    fadeOut: true,
    shuffleByDefault: false,
    shortcutIn: 'I',
    shortcutOut: 'O',
    autoTitleFromCaptions: true
  };
}

test('Home action menu opens with Enter and closes with Escape', async () => {
  installDomShim();
  const { Home } = await import('../src/screens/Home.js');
  const sequence = makeSequence({
    id: 'keyboard-home',
    name: '키보드 테이프',
    segments: [makeSegment({ id: 'home-clip', title: '키보드 클립' })]
  });
  const page = Home({
    state: {
      route: 'home',
      store: { sequences: [sequence], selectedSequenceId: sequence.id },
      settings: baseSettings(),
      pageInfo: null,
      videoState: null,
      playbackState: null,
      playbackDisplay: null,
      draftIn: null,
      draftOut: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      captureNotice: null,
      settingsNotice: null,
      pendingImport: null,
      homeSearch: '',
      homeSourceFilter: '__all_sources__',
      homeSort: 'manual',
      loading: false
    },
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });
  const menuButton = findByAriaLabel(page, '키보드 테이프 메뉴');
  const details = menuButton.closest('details');

  assert.equal(details.open, false);
  assert.equal(menuButton.keydown('Enter').defaultPrevented, true);
  assert.equal(details.open, true);
  assert.equal(menuButton.keydown('Escape').defaultPrevented, true);
  assert.equal(details.open, false);
});

test('Capture segment menu opens with Space and closes with Escape', async () => {
  installDomShim();
  const { Capture } = await import('../src/screens/Capture.js');
  const segment = makeSegment({ id: 'capture-clip', title: '키보드 구간' });
  const sequence = makeSequence({
    id: 'keyboard-capture',
    name: '편집 테이프',
    segments: [segment]
  });
  const page = Capture({
    state: {
      route: 'capture',
      store: { sequences: [sequence], selectedSequenceId: sequence.id },
      settings: baseSettings(),
      pageInfo: null,
      videoState: null,
      playbackState: null,
      playbackDisplay: null,
      draftIn: null,
      draftOut: null,
      capturePulseId: null,
      queueEdit: null,
      segmentEdit: null,
      renameEdit: null,
      captureNotice: null,
      settingsNotice: null,
      pendingImport: null,
      loading: false
    },
    onIn: () => {},
    onOut: () => {}
  });
  const menuButton = findByAriaLabel(page, '키보드 구간 메뉴');
  const details = menuButton.closest('details');

  assert.equal(details.open, false);
  assert.equal(menuButton.keydown(' ').defaultPrevented, true);
  assert.equal(details.open, true);
  assert.equal(menuButton.keydown('Escape').defaultPrevented, true);
  assert.equal(details.open, false);
});
