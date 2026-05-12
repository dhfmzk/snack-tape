// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';

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

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentNode = null;
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
    this.listeners = {};
    this.style = {};
    this.src = '';
    this.alt = '';
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  error() {
    for (const listener of this.listeners.error ?? []) {
      listener({ currentTarget: this, target: this });
    }
  }

  remove() {
    this.parentNode?.removeChild(this);
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

function findByTag(node, tagName) {
  if (node.tagName === tagName.toUpperCase()) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findByTag(child, tagName);
    if (found) {
      return found;
    }
  }

  return null;
}

test('Thumb renders YouTube thumbnails as images with a fallback on load error', async () => {
  installDomShim();
  const { Thumb, youtubeThumbUrl } = await import('../src/components/Thumb.js');

  const thumb = Thumb({ themeKey: 'peach', videoId: 'abc123XYZ_1', duration: 12 });
  const image = findByTag(thumb, 'img');

  assert.equal(image.src, youtubeThumbUrl('abc123XYZ_1'));
  assert.equal(image.alt, '');
  assert.equal(image.attributes.loading, 'lazy');

  image.error();

  assert.equal(thumb.dataset.thumbFailed, 'true');
  assert.equal(image.parentNode, null);
});
