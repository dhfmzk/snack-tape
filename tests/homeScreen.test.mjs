import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

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

function findAllByAriaLabel(node, label) {
  const matches = [];
  if (node.attributes?.['aria-label'] === label) {
    matches.push(node);
  }

  for (const child of node.children ?? []) {
    matches.push(...findAllByAriaLabel(child, label));
  }

  return matches;
}

function textOf(node) {
  return [node.textContent, ...(node.children ?? []).map(textOf)].join('');
}

function homeState(sequences) {
  return {
    route: 'home',
    store: {
      sequences,
      selectedSequenceId: sequences[0]?.id ?? null
    },
    settings: {
      accentKey: 'peach',
      autoNext: true,
      fadeOut: true,
      shuffleByDefault: false,
      shortcutIn: 'I',
      shortcutOut: 'O',
      autoTitleFromCaptions: true
    },
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    loading: false
  };
}

test('Home mixtape list scrolls instead of shrinking cards when many mixtapes exist', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const sequences = Array.from({ length: 16 }, (_, index) => makeSequence({
    id: `sequence-${index + 1}`,
    name: `믹스테이프 ${index + 1}`,
    segments: []
  }));
  const page = Home({
    state: homeState(sequences),
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });

  const list = page.children[1];
  const firstCard = list.children[0];

  assert.equal(list.dataset.scrollKey, 'home-mixtapes');
  assert.equal(list.style.overflow, 'auto');
  assert.equal(list.style.minHeight, '0');
  assert.equal(firstCard.style.flexShrink, '0');
});

test('Home empty state shows a single new tape action', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');

  const page = Home({
    state: homeState([]),
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });

  assert.equal(findAllByAriaLabel(page, '새 테이프 만들기').length, 1);
});

test('Home total duration treats zero-second OUT as a saved boundary, not missing data', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');

  const page = Home({
    state: homeState([
      makeSequence({
        id: 'sequence-zero',
        name: '0초 테이프',
        segments: [makeSegment({ id: 'zero-clip', startSeconds: 0, endSeconds: 0 })]
      })
    ]),
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });

  assert.match(textOf(page), /00:00/);
});
