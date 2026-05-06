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

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ currentTarget: this, target: this });
    }
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

function baseState(accentKey = 'coral') {
  return {
    route: 'settings',
    store: {
      sequences: [],
      selectedSequenceId: null
    },
    settings: {
      accentKey,
      autoNext: true,
      fadeOut: true,
      shuffleByDefault: false,
      shortcutIn: 'I',
      shortcutOut: 'O',
      defaultMixtapeId: 'sequence-1',
      autoTitleFromCaptions: true
    },
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    loading: false
  };
}

function textOf(node) {
  return [node.textContent, node.innerHTML, ...(node.children ?? []).map(textOf)].join('');
}

test('Settings renders the full handoff settings template in palette order', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');

  const state = baseState();
  state.store = {
    selectedSequenceId: 'sequence-1',
    sequences: [{ id: 'sequence-1', name: '잠 안 올 때 라이브', segments: [] }]
  };

  const page = Settings({ state, onAccent: () => {}, onSettingChange: () => {} });
  const text = textOf(page);
  const colorSection = page.children[1];
  const swatchGrid = colorSection.children[2];

  assert.equal(page.dataset.scrollKey, 'settings-screen');
  assert.match(text, /설정/);
  assert.match(text, /포인트 컬러/);
  assert.match(text, /현재 재생 \/ 저장 \/ 활성 상태에 사용되는 색입니다\./);
  assert.match(text, /CORAL/);
  assert.match(text, /재생/);
  assert.match(text, /자동 다음 재생/);
  assert.match(text, /구간 끝나면 다음 클립으로/);
  assert.match(text, /구간 끝에서 0\.3초 페이드/);
  assert.match(text, /끊김 부드럽게/);
  assert.match(text, /기본 시작 시 셔플/);
  assert.match(text, /캡처/);
  assert.match(text, /단축키 — IN/);
  assert.match(text, /단축키 — OUT \+ 저장/);
  assert.match(text, /기본 저장 위치/);
  assert.match(text, /잠 안 올 때 라이브/);
  assert.match(text, /OUT 시 자동 제목 추론/);
  assert.match(text, /자막·챕터에서 추출/);
  assert.match(text, /데이터/);
  assert.match(text, /내보내기/);
  assert.match(text, /JSON · CSV/);
  assert.match(text, /가져오기/);
  assert.match(text, /모든 클립 삭제/);
  assert.match(text, /SNACKTAPE v0\.1\.0 · MV3 SIDE PANEL/);
  assert.match(text, /BY YOU · 2026/);
  assert.deepEqual(swatchGrid.children.map((swatch) => swatch.children[1].textContent), ['peach', 'coral', 'butter', 'seafoam', 'sky']);
});

test('Settings wires handoff toggles to persisted setting patches', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');
  const patches = [];

  const page = Settings({
    state: baseState(),
    onAccent: () => {},
    onSettingChange: (patch) => patches.push(patch)
  });

  const playbackSection = page.children[2];
  playbackSection.children[1].children[1].click();
  playbackSection.children[2].children[1].click();
  playbackSection.children[3].children[1].click();

  const captureSection = page.children[3];
  captureSection.children[4].children[1].click();

  assert.deepEqual(patches, [
    { autoNext: false },
    { fadeOut: false },
    { shuffleByDefault: true },
    { autoTitleFromCaptions: false }
  ]);
});
