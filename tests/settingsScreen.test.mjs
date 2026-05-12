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
    this.value = '';
    this.disabled = false;
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
      listener({ currentTarget: this, target: this, stopPropagation() {} });
    }
  }

  change() {
    for (const listener of this.listeners.change ?? []) {
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
      language: 'ko',
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
  const languageSection = page.children[1];
  const languageSelect = languageSection.children[0].children[1];
  const colorSection = page.children[2];
  const swatchGrid = colorSection.children[2];

  assert.equal(page.dataset.scrollKey, 'settings-screen');
  assert.equal(languageSelect.tagName, 'SELECT');
  assert.match(text, /설정/);
  assert.match(text, /언어/);
  assert.match(text, /앱 표시 언어입니다\./);
  assert.deepEqual(languageSelect.children.map((choice) => choice.textContent), ['한국어', 'English', '日本語']);
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
  assert.match(text, /Chrome 확장 프로그램 단축키에서 변경할 수 있습니다\./);
  assert.match(text, /기본 저장 위치/);
  assert.match(text, /잠 안 올 때 라이브/);
  assert.match(text, /OUT 시 자동 제목 추론/);
  assert.match(text, /자막·챕터에서 추출/);
  assert.match(text, /데이터/);
  assert.match(text, /내보내기/);
  assert.match(text, /JSON/);
  assert.match(text, /CSV/);
  assert.match(text, /가져오기/);
  assert.match(text, /JSON 백업 파일로 교체/);
  assert.match(text, /모든 클립 삭제/);
  assert.match(text, /믹스테이프와 저장된 구간을 비웁니다\./);
  assert.match(text, /SNACKTAPE v0\.1\.0 · MV3 SIDE PANEL/);
  assert.match(text, /BY dhfmzk · 2026/);
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

  const playbackSection = page.children[3];
  playbackSection.children[1].children[1].click();
  playbackSection.children[2].children[1].click();
  playbackSection.children[3].children[1].click();

  const captureSection = page.children[4];
  captureSection.children[4].children[1].click();

  assert.deepEqual(patches, [
    { autoNext: false },
    { fadeOut: false },
    { shuffleByDefault: true },
    { autoTitleFromCaptions: false }
  ]);
});

test('Settings wires default save target selection to persisted setting patches', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');
  const selected = [];
  const state = baseState();
  state.store = {
    selectedSequenceId: 'sequence-1',
    sequences: [
      { id: 'sequence-1', name: '첫 테이프', segments: [] },
      { id: 'sequence-2', name: '둘째 테이프', segments: [] }
    ]
  };

  const page = Settings({
    state,
    onAccent: () => {},
    onDefaultSaveTarget: (sequenceId) => selected.push(sequenceId)
  });

  const captureSection = page.children[4];
  const select = captureSection.children[3].children[1];
  select.value = 'sequence-2';
  select.change();

  assert.deepEqual(selected, ['sequence-2']);
});

test('Settings wires data actions to export, import, reset, and delete callbacks', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');
  const calls = [];

  const page = Settings({
    state: baseState(),
    onAccent: () => {},
    onExport: (format) => calls.push(['export', format]),
    onImport: () => calls.push(['import']),
    onResetSettings: () => calls.push(['reset']),
    onDeleteAll: () => calls.push(['delete'])
  });
  const dataSection = page.children[5];
  const exportButtons = dataSection.children[1].children[1].children;

  exportButtons[0].click();
  exportButtons[1].click();
  dataSection.children[2].click();
  dataSection.children[3].click();
  dataSection.children[4].click();

  assert.deepEqual(calls, [
    ['export', 'json'],
    ['export', 'csv'],
    ['import'],
    ['reset'],
    ['delete']
  ]);
});

test('Settings renders import preview actions when a pending import exists', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');
  const calls = [];
  const state = baseState();
  state.pendingImport = {
    store: {
      sequences: [{ id: 'imported', name: 'Imported Tape', segments: [] }],
      selectedSequenceId: 'imported'
    },
    summary: {
      tapeCount: 2,
      clipCount: 9,
      duplicateNameCount: 1,
      duplicateRangeCount: 3
    }
  };

  const page = Settings({
    state,
    onAccent: () => {},
    onReplaceImport: () => calls.push('replace'),
    onMergeImport: () => calls.push('merge'),
    onCancelImport: () => calls.push('cancel')
  });
  const text = textOf(page);

  assert.match(text, /가져오기 미리보기/);
  assert.match(text, /2개 믹스테이프 · 9개 클립/);
  assert.match(text, /이름 중복 1개 · 구간 중복 의심 3개/);

  const preview = page.children[2];
  const actions = preview.children[3].children;
  actions[0].click();
  actions[1].click();
  actions[2].click();

  assert.deepEqual(calls, ['replace', 'merge', 'cancel']);
});

test('Settings wires language dropdown to persisted setting patches', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');
  const patches = [];

  const page = Settings({
    state: baseState(),
    onAccent: () => {},
    onSettingChange: (patch) => patches.push(patch)
  });

  const languageSelect = page.children[1].children[0].children[1];
  languageSelect.value = 'ja';
  languageSelect.change();

  assert.deepEqual(patches, [{ language: 'ja' }]);
});

test('Settings language dropdown keeps stable dimensions across locales', async () => {
  installDomShim();
  const [{ Settings }, { createI18n }] = await Promise.all([
    import('../.tmp-tests/src/screens/Settings.js'),
    import('../.tmp-tests/src/i18n.js')
  ]);
  const koState = baseState();
  const enState = baseState();
  const jaState = baseState();
  enState.settings.language = 'en';
  jaState.settings.language = 'ja';

  const koPage = Settings({ state: koState, i18n: createI18n('ko'), onAccent: () => {}, onSettingChange: () => {} });
  const enPage = Settings({ state: enState, i18n: createI18n('en'), onAccent: () => {}, onSettingChange: () => {} });
  const jaPage = Settings({ state: jaState, i18n: createI18n('ja'), onAccent: () => {}, onSettingChange: () => {} });
  const koSelect = koPage.children[1].children[0].children[1];
  const enSelect = enPage.children[1].children[0].children[1];
  const jaSelect = jaPage.children[1].children[0].children[1];

  assert.equal(koSelect.style.width, enSelect.style.width);
  assert.equal(koSelect.style.width, jaSelect.style.width);
  assert.equal(koSelect.style.height, enSelect.style.height);
  assert.equal(koSelect.style.height, jaSelect.style.height);
  assert.equal(koSelect.style.flexShrink, '0');
  assert.equal(enSelect.style.flexShrink, '0');
  assert.equal(jaSelect.style.flexShrink, '0');
});

test('Settings renders English app copy when language is English', async () => {
  installDomShim();
  const [{ Settings }, { createI18n }] = await Promise.all([
    import('../.tmp-tests/src/screens/Settings.js'),
    import('../.tmp-tests/src/i18n.js')
  ]);
  const state = baseState('sky');
  state.settings.language = 'en';

  const page = Settings({ state, i18n: createI18n('en'), onAccent: () => {}, onSettingChange: () => {} });
  const text = textOf(page);

  assert.match(text, /Settings/);
  assert.match(text, /Language/);
  assert.match(text, /Accent color/);
  assert.match(text, /Playback/);
  assert.match(text, /Capture/);
  assert.match(text, /Default save location/);
  assert.match(text, /Reset settings/);
  assert.match(text, /Data/);
});

test('Settings renders Japanese app copy when language is Japanese', async () => {
  installDomShim();
  const [{ Settings }, { createI18n }] = await Promise.all([
    import('../.tmp-tests/src/screens/Settings.js'),
    import('../.tmp-tests/src/i18n.js')
  ]);
  const state = baseState('sky');
  state.settings.language = 'ja';

  const page = Settings({ state, i18n: createI18n('ja'), onAccent: () => {}, onSettingChange: () => {} });
  const text = textOf(page);

  assert.match(text, /設定/);
  assert.match(text, /言語/);
  assert.match(text, /アクセントカラー/);
  assert.match(text, /再生/);
  assert.match(text, /編集/);
  assert.match(text, /既定の保存先/);
  assert.match(text, /設定をリセット/);
  assert.match(text, /データ/);
});

test('Settings renders inline settings notices above the controls', async () => {
  installDomShim();
  const { Settings } = await import('../.tmp-tests/src/screens/Settings.js');
  const state = baseState();
  state.settingsNotice = { kind: 'info', message: 'Export is ready.' };

  const page = Settings({ state, onAccent: () => {}, onSettingChange: () => {} });

  assert.match(textOf(page), /Export is ready\./);
  assert.equal(page.children[1].textContent, 'Export is ready.');
});
