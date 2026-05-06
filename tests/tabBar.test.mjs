import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(text = '') {
    this.children = [];
    this.textContent = text;
  }

  append(...children) {
    this.children.push(...children);
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
    this.style = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
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

function textOf(node) {
  return [node.textContent, ...(node.children ?? []).map(textOf)].join('');
}

test('Tab bar order is edit, mixtape, settings with mixtape centered', async () => {
  installDomShim();
  const { TabBar } = await import('../.tmp-tests/src/components/TabBar.js');

  const tabBar = TabBar('home', () => {});
  const buttons = tabBar.children;

  assert.deepEqual(buttons.map(textOf), ['편집', '믹스테이프', '설정']);
  assert.equal(buttons[1].attributes['aria-selected'], 'true');
});
