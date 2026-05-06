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

  querySelector(selector) {
    if (!selector.startsWith('.')) {
      return null;
    }

    const className = selector.slice(1);
    return findByClass(this, className);
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
    if (name === 'class') {
      this.className = String(value);
    }
  }

  addEventListener(type, listener) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  click() {
    for (const listener of this.listeners.click ?? []) {
      listener({ stopPropagation() {} });
    }
  }
}

function findByClass(node, className) {
  if (node.className?.split(/\s+/).includes(className)) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findByClass(child, className);
    if (found) {
      return found;
    }
  }

  return null;
}

function textOf(node) {
  return [node.textContent, ...(node.children ?? []).map(textOf)].join('');
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

function installDomShim() {
  globalThis.Node = FakeNode;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
    createTextNode: (text) => new FakeNode(String(text))
  };
}

test('Playback progress uses playback state timing when live page info is unavailable', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const originalNow = Date.now;
  Date.now = () => 1700000005000;
  const sequence = makeSequence({
    id: 'sequence-progress',
    name: '진행률 믹스테이프',
    segments: [makeSegment({ id: 'clip-progress', title: '진행률 클립', startSeconds: 10, endSeconds: 20 })]
  });
  const state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
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
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-progress',
      status: 'playing',
      startedAt: 1700000000000
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '진행률 클립',
      positionText: '1 / 1',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    loading: false
  };

  try {
    const page = Playback({
      state,
      onBack: () => {},
      onPlay: () => {},
      onStop: () => {},
      onNext: () => {},
      onEditSequence: () => {},
      onCancelQueueEdit: () => {},
      onSaveQueueEdit: () => {},
      onMoveQueueSegment: () => {},
      onRemoveQueueSegment: () => {}
    });
    const progressBar = findByAriaLabel(page, '재생 진행률');

    assert.equal(progressBar.dataset.progressRatio, '0.5');
    assert.match(progressBar.children[0].style.cssText, /width: 50%/);
    assert.match(progressBar.children[0].style.cssText, /snacktape-progress-fill 5s linear forwards/);
  } finally {
    Date.now = originalNow;
  }
});

test('Playback renders the active playback sequence instead of the first mixtape', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const firstSequence = makeSequence({
    id: 'first-sequence',
    name: '첫 번째 믹스테이프',
    segments: [makeSegment({ id: 'first-clip', title: '첫 번째 클립', videoId: 'firstVideo' })]
  });
  const secondSequence = makeSequence({
    id: 'second-sequence',
    name: '두 번째 믹스테이프',
    segments: [makeSegment({ id: 'second-clip', title: '두 번째 클립', videoId: 'secondVideo' })]
  });
  const state = {
    route: 'playback',
    store: {
      sequences: [firstSequence, secondSequence],
      selectedSequenceId: secondSequence.id
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
    playbackState: {
      sequenceId: secondSequence.id,
      segmentIndex: 0,
      currentSegmentId: 'second-clip',
      status: 'playing',
      startedAt: 1700000000000
    },
    playbackDisplay: {
      sequenceName: secondSequence.name,
      segmentTitle: '두 번째 클립',
      positionText: '1 / 1',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    loading: false
  };

  const page = Playback({ state, onBack: () => {}, onPlay: () => {}, onStop: () => {}, onNext: () => {} });
  const renderedText = textOf(page);

  assert.match(renderedText, /두 번째 클립/);
  assert.doesNotMatch(renderedText, /첫 번째 클립/);
});

test('Playback template controls are wired to playback callbacks', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-2',
    name: '두 번째 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '현재 클립', videoId: 'video2' }),
      makeSegment({ id: 'clip-3', title: '다음 클립', videoId: 'video3' })
    ]
  });
  const state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
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
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 1,
      currentSegmentId: 'clip-2',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '현재 클립',
      positionText: '2 / 3',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    loading: false
  };
  const calls = [];

  const page = Playback({
    state,
    onBack: () => calls.push(['back']),
    onPlay: (index, sequenceId, mode) => calls.push(['play', index, sequenceId, mode]),
    onStop: () => calls.push(['stop']),
    onNext: () => calls.push(['next'])
  });

  findByAriaLabel(page, '믹스테이프로 돌아가기').click();
  findByAriaLabel(page, '셔플 재생').click();
  findByAriaLabel(page, '이전 클립').click();
  findByAriaLabel(page, '정지').click();
  findByAriaLabel(page, '다음 클립').click();
  findByAriaLabel(page, '현재 클립 다시 재생').click();
  findByAriaLabel(page, '다음 클립 재생').click();

  assert.deepEqual(calls, [
    ['back'],
    ['play', 1, sequence.id, 'shuffle'],
    ['play', 0, sequence.id, 'sequence'],
    ['stop'],
    ['next'],
    ['play', 1, sequence.id, 'sequence'],
    ['play', 2, sequence.id, 'sequence']
  ]);
});

test('Playback edit button opens the current mixtape in the edit tab', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-edit',
    name: '편집할 믹스테이프',
    segments: [makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' })]
  });
  const state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
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
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-1',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '첫 클립',
      positionText: '1 / 1',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };
  const calls = [];

  const page = Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: (sequenceId) => calls.push(['edit', sequenceId]),
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });

  findByAriaLabel(page, '믹스테이프 편집').click();

  assert.equal(findByAriaLabel(page, '큐 편집'), null);
  assert.deepEqual(calls, [['edit', sequence.id]]);
});

test('Playback title rename button opens the current mixtape rename flow', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-rename',
    name: '이름 바꿀 믹스테이프',
    segments: [makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' })]
  });
  const state = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
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
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-1',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '첫 클립',
      positionText: '1 / 1',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    renameEdit: null,
    loading: false
  };
  const calls = [];

  const page = Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onRenameSequence: (sequenceId) => calls.push(['rename', sequenceId]),
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });

  findByAriaLabel(page, '믹스테이프 이름 변경').click();

  assert.deepEqual(calls, [['rename', sequence.id]]);
});

test('Playback queue edit mode exposes reorder, remove, cancel, and save callbacks', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-edit',
    name: '편집할 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '현재 클립', videoId: 'video2' }),
      makeSegment({ id: 'clip-3', title: '다음 클립', videoId: 'video3' })
    ]
  });
  const baseState = {
    route: 'playback',
    store: {
      sequences: [sequence],
      selectedSequenceId: sequence.id
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
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 1,
      currentSegmentId: 'clip-2',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '현재 클립',
      positionText: '2 / 3',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };
  const calls = [];
  const handlers = {
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onCancelQueueEdit: () => calls.push(['cancel']),
    onSaveQueueEdit: () => calls.push(['save']),
    onMoveQueueSegment: (fromIndex, toIndex) => calls.push(['move', fromIndex, toIndex]),
    onRemoveQueueSegment: (segmentId) => calls.push(['remove', segmentId])
  };

  const editPage = Playback({
    state: {
      ...baseState,
      queueEdit: {
        sequenceId: sequence.id,
        segmentIds: ['clip-2', 'clip-1', 'clip-3']
      }
    },
    ...handlers
  });

  findByAriaLabel(editPage, '첫 클립 위로 이동').click();
  findByAriaLabel(editPage, '다음 클립 큐에서 제거').click();
  findByAriaLabel(editPage, '큐 편집 취소').click();
  findByAriaLabel(editPage, '큐 편집 완료').click();

  assert.match(textOf(editPage), /편집 중/);
  assert.deepEqual(calls, [
    ['move', 1, 0],
    ['remove', 'clip-3'],
    ['cancel'],
    ['save']
  ]);
});
