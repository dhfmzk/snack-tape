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
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      }
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') {
      this.className = String(value);
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

function baseState(overrides = {}) {
  return {
    route: 'capture',
    store: {
      sequences: [],
      selectedSequenceId: null
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
    loading: false,
    ...overrides
  };
}

test('SidePanel screen-level scroll containers have stable scroll keys', async () => {
  installDomShim();
  const [{ Capture }, { Settings }, { Detail }] = await Promise.all([
    import('../.tmp-tests/src/screens/Capture.js'),
    import('../.tmp-tests/src/screens/Settings.js'),
    import('../.tmp-tests/src/screens/Detail.js')
  ]);

  assert.equal(Capture({ state: baseState(), onIn: () => {}, onOut: () => {} }).dataset.scrollKey, 'capture-screen');
  assert.equal(Settings({ state: baseState(), onAccent: () => {} }).dataset.scrollKey, 'settings-screen');
  assert.equal(Detail().dataset.scrollKey, 'detail-screen');
});

test('primary side-panel screens render an empty store without a selected mixtape', async () => {
  installDomShim();
  const [{ Home }, { Capture }, { Playback }, { Settings }] = await Promise.all([
    import('../.tmp-tests/src/screens/Home.js'),
    import('../.tmp-tests/src/screens/Capture.js'),
    import('../.tmp-tests/src/screens/Playback.js'),
    import('../.tmp-tests/src/screens/Settings.js')
  ]);
  const state = baseState({
    store: {
      sequences: [],
      selectedSequenceId: null
    }
  });

  assert.doesNotThrow(() => Home({ state, onCreate: () => {}, onOpenSequence: () => {}, onPlaySequence: () => {} }));
  assert.doesNotThrow(() => Capture({ state, onIn: () => {}, onOut: () => {}, onCreateMixtape: () => {} }));
  assert.doesNotThrow(() => Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  }));
  assert.doesNotThrow(() => Settings({ state, onAccent: () => {} }));
});
