import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSegment, makeSequence } from './helpers.mjs';

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

  change() {
    for (const listener of this.listeners.change ?? []) {
      listener({ target: this });
    }
  }

  input() {
    for (const listener of this.listeners.input ?? []) {
      listener({ target: this });
    }
  }

  keydown(key) {
    for (const listener of this.listeners.keydown ?? []) {
      listener({ key, target: this, preventDefault() {} });
    }
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ currentTarget: this, target: this, stopPropagation() {} });
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

function findAll(node, predicate, results = []) {
  if (predicate(node)) {
    results.push(node);
  }

  for (const child of node.children ?? []) {
    findAll(child, predicate, results);
  }

  return results;
}

function textOf(node) {
  return [node.textContent, ...(node.children ?? []).map(textOf)].join('');
}

function baseState() {
  const first = makeSequence({
    id: 'first',
    name: '첫 번째 테이프',
    segments: [makeSegment({ id: 'first-clip', title: '첫 번째 클립' })]
  });
  const second = makeSequence({
    id: 'second',
    name: '선택된 테이프',
    segments: [makeSegment({ id: 'second-clip', title: '선택된 클립' })]
  });

  return {
    route: 'capture',
    store: {
      sequences: [first, second],
      selectedSequenceId: second.id
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
    draftOut: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };
}

function usableState(overrides = {}) {
  return {
    ...baseState(),
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'abc123XYZ_1',
      title: '테스트 영상',
      url: 'https://www.youtube.com/watch?v=abc123XYZ_1',
      currentTime: 42,
      duration: 120
    },
    draftIn: 42,
    ...overrides
  };
}

test('Capture save target uses the selected mixtape and can change target', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {},
    onTargetSequence: (sequenceId) => calls.push(sequenceId)
  });
  const select = findByAriaLabel(page, '저장 위치 선택');
  const saveTarget = page.children[0];

  assert.equal(saveTarget.attributes['aria-label'], '저장 위치');
  assert.match(textOf(page), /선택된 테이프/);
  assert.match(textOf(page), /선택된 클립/);
  assert.doesNotMatch(textOf(page), /첫 번째 클립/);

  select.value = 'first';
  select.change();

  assert.deepEqual(calls, ['first']);
});

test('Capture save target keeps the native select visible and clickable', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {},
    onTargetSequence: () => {}
  });
  const select = findByAriaLabel(page, '저장 위치 선택');

  assert.equal(select.style.opacity, undefined);
  assert.notEqual(select.style.position, 'absolute');
  assert.equal(select.style.cursor, 'pointer');
});

test('Capture edit tab can request deletion of the selected mixtape', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {},
    onDeleteMixtape: (sequenceId) => calls.push(sequenceId)
  });

  findByAriaLabel(page, '선택된 테이프 삭제').click();

  assert.deepEqual(calls, ['second']);
});

test('Capture edit tab can rename the selected mixtape from the save target bar', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: {
      ...baseState(),
      renameEdit: { sequenceId: 'second' }
    },
    onIn: () => {},
    onOut: () => {},
    onRenameMixtape: (sequenceId, name) => calls.push([sequenceId, name])
  });
  const input = findByAriaLabel(page, '믹스테이프 이름');

  assert.equal(input.value, '선택된 테이프');
  input.value = '  새 이름  ';
  findByAriaLabel(page, '믹스테이프 이름 저장').click();

  assert.deepEqual(calls, [['second', '새 이름']]);
});

test('Capture edit tab disables mixtape rename save for an empty name and supports Escape cancel', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: {
      ...baseState(),
      renameEdit: { sequenceId: 'second' }
    },
    onIn: () => {},
    onOut: () => {},
    onCancelRenameMixtape: () => calls.push(['cancel']),
    onRenameMixtape: (sequenceId, name) => calls.push(['rename', sequenceId, name])
  });
  const input = findByAriaLabel(page, '믹스테이프 이름');
  const save = findByAriaLabel(page, '믹스테이프 이름 저장');

  input.value = '   ';
  input.input();
  assert.equal(save.disabled, true);

  input.keydown('Escape');
  assert.deepEqual(calls, [['cancel']]);
});

test('Capture edit tab shows every segment in the selected mixtape', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const segments = Array.from({ length: 8 }, (_, index) =>
    makeSegment({
      id: `clip-${index + 1}`,
      title: `편집 클립 ${index + 1}`,
      startSeconds: index * 10,
      endSeconds: index * 10 + 4,
    })
  );

  const page = Capture({
    state: {
      ...baseState(),
      store: {
        sequences: [
          makeSequence({
            id: 'selected',
            name: '선택된 테이프',
            segments,
          }),
        ],
        selectedSequenceId: 'selected',
      },
    },
    onIn: () => {},
    onOut: () => {},
  });

  const text = textOf(page);
  const actionMenus = findAll(page, (node) => node.className === 'segment-action-menu');
  const segmentLists = findAll(page, (node) => node.dataset?.scrollKey === 'capture-segments:selected');

  assert.match(text, /이번 세션 · 8개 저장됨/);
  assert.match(text, /편집 클립 1/);
  assert.match(text, /편집 클립 8/);
  assert.equal(actionMenus.length, 8);
  assert.equal(segmentLists.length, 1);
});

test('Capture edit tab opens a segment action menu instead of deleting from the more button', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => calls.push(['add']),
    onBeginSegmentEdit: (segmentId) => calls.push(['edit', segmentId]),
    onDuplicateSegment: (segmentId) => calls.push(['duplicate', segmentId]),
    onDeleteSegment: (segmentId) => calls.push(['delete', segmentId])
  });

  findByAriaLabel(page, 'OUT 마커 찍고 추가').click();
  findByAriaLabel(page, '선택된 클립 메뉴').click();
  findByAriaLabel(page, '선택된 클립 구간 편집').click();
  findByAriaLabel(page, '선택된 클립 복제').click();
  findByAriaLabel(page, '선택된 클립 삭제').click();

  assert.match(textOf(page), /OUT \+ 추가/);
  assert.match(textOf(page), /구간 편집/);
  assert.match(textOf(page), /복제/);
  assert.match(textOf(page), /삭제/);
  assert.deepEqual(calls, [
    ['add'],
    ['edit', 'second-clip'],
    ['duplicate', 'second-clip'],
    ['delete', 'second-clip']
  ]);
});

test('Capture closes segment action menus before running edit or delete actions', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {},
    onBeginSegmentEdit: (segmentId) => calls.push(['edit', segmentId]),
    onDeleteSegment: (segmentId) => calls.push(['delete', segmentId])
  });
  const menus = findAll(page, (node) => node.className === 'segment-action-menu');
  const menu = menus[0];

  menu.setAttribute('open', '');
  findByAriaLabel(page, '선택된 클립 구간 편집').click();

  assert.equal(menu.open, false);
  assert.equal(menu.attributes.open, undefined);
  assert.deepEqual(calls, [['edit', 'second-clip']]);

  menu.setAttribute('open', '');
  findByAriaLabel(page, '선택된 클립 삭제').click();

  assert.equal(menu.open, false);
  assert.equal(menu.attributes.open, undefined);
  assert.deepEqual(calls, [
    ['edit', 'second-clip'],
    ['delete', 'second-clip']
  ]);
});

test('Capture segment menu can copy or move a clip to another mixtape', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {},
    onCopySegmentToMixtape: (segmentId, targetSequenceId) => calls.push(['copy', segmentId, targetSequenceId]),
    onMoveSegmentToMixtape: (segmentId, targetSequenceId) => calls.push(['move', segmentId, targetSequenceId])
  });

  const target = findByAriaLabel(page, '선택된 클립 이동/복사 대상');
  target.value = 'first';
  target.change();
  findByAriaLabel(page, '선택된 클립 복사').click();
  findByAriaLabel(page, '선택된 클립 이동').click();

  assert.deepEqual(calls, [
    ['copy', 'second-clip', 'first'],
    ['move', 'second-clip', 'first']
  ]);
});

test('Capture edit tab exposes segment range edit controls when a segment is selected for editing', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: usableState({ segmentEdit: { segmentId: 'second-clip' } }),
    onIn: () => {},
    onOut: () => {},
    onNudgeSegment: (segmentId, edge, deltaSeconds) => calls.push(['nudge', segmentId, edge, deltaSeconds]),
    onCancelSegmentEdit: () => calls.push(['done'])
  });

  findByAriaLabel(page, '선택된 클립 시작 -1f').click();
  findByAriaLabel(page, '선택된 클립 끝 +1s').click();
  findByAriaLabel(page, '선택된 클립 편집 완료').click();

  assert.match(textOf(page), /구간 편집/);
  assert.deepEqual(calls, [
    ['nudge', 'second-clip', 'start', -1 / 30],
    ['nudge', 'second-clip', 'end', 1],
    ['done']
  ]);
});

test('Capture edit tab commits exact segment timecode inputs and resets them with Escape', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: usableState({ segmentEdit: { segmentId: 'second-clip' } }),
    onIn: () => {},
    onOut: () => {},
    onSetSegmentTimecode: (segmentId, edge, value) => calls.push([segmentId, edge, value])
  });
  const startInput = findByAriaLabel(page, '선택된 클립 시작 시간');
  const endInput = findByAriaLabel(page, '선택된 클립 끝 시간');

  assert.equal(startInput.value, '00:10.00');
  assert.equal(endInput.value, '00:20.00');

  startInput.value = '00:12.50';
  startInput.change();
  endInput.value = '00:18.25';
  endInput.keydown('Enter');
  endInput.value = 'bad';
  endInput.keydown('Escape');

  assert.equal(endInput.value, '00:20.00');
  assert.deepEqual(calls, [
    ['second-clip', 'start', '00:12.50'],
    ['second-clip', 'end', '00:18.25']
  ]);
});

test('Capture exact segment timecode inputs preserve hour-long hundredths', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const hourSegment = makeSegment({
    id: 'hour-clip',
    title: '긴 클립',
    startSeconds: 3723.25,
    endSeconds: 3784.05
  });

  const page = Capture({
    state: {
      ...usableState({ segmentEdit: { segmentId: 'hour-clip' } }),
      store: {
        sequences: [makeSequence({ id: 'hour-sequence', name: '긴 테이프', segments: [hourSegment] })],
        selectedSequenceId: 'hour-sequence'
      }
    },
    onIn: () => {},
    onOut: () => {}
  });
  const startInput = findByAriaLabel(page, '긴 클립 시작 시간');
  const endInput = findByAriaLabel(page, '긴 클립 끝 시간');

  assert.equal(startInput.value, '1:02:03.25');
  assert.equal(endInput.value, '1:03:04.05');
});

test('Capture edit tab renders zero-second OUT values as saved times, not END', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const zeroSegment = makeSegment({
    id: 'zero-clip',
    title: '0초 클립',
    startSeconds: 0,
    endSeconds: 0
  });

  const page = Capture({
    state: {
      ...baseState(),
      store: {
        sequences: [makeSequence({ id: 'zero-sequence', name: '0초 테이프', segments: [zeroSegment] })],
        selectedSequenceId: 'zero-sequence'
      }
    },
    onIn: () => {},
    onOut: () => {}
  });
  const text = textOf(page);

  assert.match(text, /00:00\.00/);
  assert.doesNotMatch(text, /END/);
});

test('Capture segment action menus expose expanded state and menu item roles', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {}
  });
  const menuButton = findByAriaLabel(page, '선택된 클립 메뉴');
  const menuItems = findAll(page, (node) => node.attributes?.role === 'menuitem');

  assert.equal(menuButton.attributes['aria-haspopup'], 'menu');
  assert.equal(menuButton.attributes['aria-expanded'], 'false');
  assert.equal(menuItems.length, 5);
});

test('Capture edit tab wires every enabled button', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: usableState(),
    onIn: () => {},
    onOut: () => {},
    onNudgeDraft: () => {},
    onDeleteSegment: () => {}
  });
  const enabledButtons = findAll(page, (node) => node.tagName === 'BUTTON' && !node.disabled);
  const unwired = enabledButtons.filter((button) => (button.listeners.click ?? []).length === 0);

  assert.deepEqual(unwired.map(textOf), []);
});

test('Capture edit tab wires draft nudge controls to frame and second deltas', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: usableState(),
    onIn: () => {},
    onOut: () => {},
    onNudgeDraft: (deltaSeconds) => calls.push(deltaSeconds)
  });

  for (const button of findAll(page, (node) => node.tagName === 'BUTTON')) {
    if (['-1s', '-1f', '+1f', '+1s'].includes(textOf(button))) {
      button.click();
    }
  }

  assert.deepEqual(calls, [-1, -1 / 30, 1 / 30, 1]);
});

test('Capture IN and OUT buttons use theme accent contrast instead of fixed low-visibility colors', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: usableState(),
    onIn: () => {},
    onOut: () => {}
  });
  const inButton = findByAriaLabel(page, 'IN 마커 찍기');
  const outButton = findByAriaLabel(page, 'OUT 마커 찍고 추가');

  assert.match(inButton.style.border, /var\(--accent\)/);
  assert.equal(inButton.style.background, 'var(--accent-soft)');
  assert.equal(inButton.style.color, 'var(--accent2)');
  assert.match(inButton.style.boxShadow, /var\(--accent-glow\)/);
  assert.equal(outButton.disabled, false);
  assert.equal(outButton.style.background, 'var(--accent)');
  assert.equal(outButton.style.color, 'var(--accent-ink)');
});

test('Capture OUT button is not primary until an IN marker exists', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: usableState({ draftIn: null }),
    onIn: () => {},
    onOut: () => {}
  });
  const inButton = findByAriaLabel(page, 'IN 마커 찍기');
  const outButton = findByAriaLabel(page, 'OUT 마커 찍고 추가');

  assert.equal(inButton.disabled, false);
  assert.equal(inButton.style.background, 'var(--accent-soft)');
  assert.equal(outButton.disabled, true);
  assert.equal(outButton.style.background, 'var(--surface2)');
  assert.equal(outButton.style.color, 'var(--mute)');
  assert.doesNotMatch(outButton.style.boxShadow, /var\(--accent-glow\)/);
  assert.match(textOf(outButton), /IN 먼저/);
});

test('Capture OUT button previews OUT and save button commits the draft', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: usableState({ draftOut: 45 }),
    onIn: () => calls.push('in'),
    onOut: () => calls.push('save'),
    onPreviewOut: () => calls.push('preview'),
    onClearDraft: () => calls.push('clear')
  });
  const outButton = findByAriaLabel(page, 'OUT 마커 미리보기');
  const saveButton = findByAriaLabel(page, '현재 구간 저장');
  const clearButton = findByAriaLabel(page, '캡처 드래프트 취소');

  assert.match(textOf(outButton), /00:45.00/);
  assert.equal(saveButton.disabled, false);

  outButton.click();
  saveButton.click();
  clearButton.click();

  assert.deepEqual(calls, ['preview', 'save', 'clear']);
});

test('Capture OUT button uses preview-only aria label when preview handler is wired', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: usableState(),
    onIn: () => {},
    onOut: () => {},
    onPreviewOut: () => {}
  });

  const outButton = findByAriaLabel(page, 'OUT 마커 미리보기');
  assert.ok(outButton);
  assert.equal(findByAriaLabel(page, 'OUT 마커 찍고 추가'), null);
});

test('Capture OUT preview aria label has localized copy', async () => {
  const { createI18n } = await import('../.tmp-tests/src/i18n.js');

  assert.equal(createI18n('ko').capture.captureOutPreviewAria, 'OUT 마커 미리보기');
  assert.equal(createI18n('ja').capture.captureOutPreviewAria, 'OUTマーカーをプレビュー');
  assert.equal(createI18n('en').capture.captureOutPreviewAria, 'Preview OUT marker');
});

test('Capture nudge buttons target OUT after an OUT marker exists', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: usableState({ draftOut: 45 }),
    onIn: () => {},
    onOut: () => {},
    onNudgeDraft: (deltaSeconds, edge) => calls.push([deltaSeconds, edge])
  });
  const minusSecond = findByAriaLabel(page, '-1s 조정');

  minusSecond.click();

  assert.deepEqual(calls, [[-1, 'end']]);
  assert.match(textOf(page), /OUT 조정/);
});

test('Capture edit tab renders inline capture notices from store state', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: usableState({
      captureNotice: {
        kind: 'error',
        message: 'IN 먼저 찍어주세요.'
      }
    }),
    onIn: () => {},
    onOut: () => {}
  });

  assert.match(textOf(page), /IN 먼저 찍어주세요\./);
});

test('Capture edit tab shows when the active tab is not a YouTube video', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: {
      ...baseState(),
      pageInfo: {
        isYouTubeVideoPage: false,
        videoId: null,
        title: 'Example',
        url: 'https://example.com/',
        currentTime: null,
        duration: null
      }
    },
    onIn: () => {},
    onOut: () => {}
  });

  assert.match(textOf(page), /현재 탭은 YouTube 영상이 아닙니다/);
});

test('Capture edit tab explains when a YouTube video time is unreadable', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: {
      ...baseState(),
      pageInfo: {
        isYouTubeVideoPage: true,
        videoId: 'abc123XYZ_1',
        title: '테스트 영상',
        url: 'https://www.youtube.com/watch?v=abc123XYZ_1',
        currentTime: null,
        duration: null
      }
    },
    onIn: () => {},
    onOut: () => {}
  });

  assert.match(textOf(page), /영상 시간을 읽을 수 없습니다/);
});

test('Capture edit tab uses the handoff capture layout instead of legacy card classes', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');

  const page = Capture({
    state: baseState(),
    onIn: () => {},
    onOut: () => {}
  });

  assert.equal(page.style.display, 'flex');
  assert.equal(page.style.flexDirection, 'column');
  assert.equal(page.children[0].attributes['aria-label'], '저장 위치');
  assert.notEqual(page.children[1].className, 'video-card');
  assert.notEqual(page.children[2].className, 'capture-buttons');
  assert.notEqual(page.children[3].className, 'section-block');
  assert.equal(page.children[2].style.gridTemplateColumns, '1fr 1fr');
});

test('Capture edit tab exposes a create target action when no mixtapes exist', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: {
      ...baseState(),
      store: {
        sequences: [],
        selectedSequenceId: null
      }
    },
    onIn: () => {},
    onOut: () => {},
    onCreateMixtape: () => calls.push('create')
  });

  findByAriaLabel(page, '새 테이프 만들기').click();

  assert.deepEqual(calls, ['create']);
});

test('Capture video header can request a manual current-time refresh', async () => {
  installDomShim();
  const { Capture } = await import('../.tmp-tests/src/screens/Capture.js');
  const calls = [];

  const page = Capture({
    state: usableState(),
    onIn: () => {},
    onOut: () => {},
    onRefreshVideo: () => calls.push('refresh')
  });

  findByAriaLabel(page, '영상 시간 새로고침').click();

  assert.deepEqual(calls, ['refresh']);
});
