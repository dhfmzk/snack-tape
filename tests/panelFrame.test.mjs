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
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = String(value);
    }
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

test('PanelFrame keys the main screen by route so route changes replace the old screen DOM', async () => {
  installDomShim();
  const { PanelFrame } = await import('../.tmp-tests/src/components/PanelFrame.js');

  const frame = PanelFrame({
    active: 'capture',
    onRoute: () => {},
    children: document.createElement('div')
  });

  assert.equal(frame.children[0].dataset.patchKey, 'panel-main:capture');
});
