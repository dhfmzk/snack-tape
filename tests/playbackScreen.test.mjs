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
    this.draggable = false;
    this.disabled = false;
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
    if (this.disabled) {
      return;
    }

    for (const listener of this.listeners.click ?? []) {
      listener({ currentTarget: this, target: this, stopPropagation() {} });
    }
  }

  clickAt(clientX) {
    if (this.disabled) {
      return;
    }

    for (const listener of this.listeners.click ?? []) {
      listener({ clientX, currentTarget: this, target: this, stopPropagation() {} });
    }
  }

  getBoundingClientRect() {
    return { left: 0, width: 100, top: 0, height: 10, right: 100, bottom: 10 };
  }

  keyDown(key) {
    for (const listener of this.listeners.keydown ?? []) {
      listener({ key, preventDefault() {}, currentTarget: this, target: this });
    }
  }

  dragStart(dataTransfer) {
    for (const listener of this.listeners.dragstart ?? []) {
      listener({ currentTarget: this, target: this, dataTransfer });
    }
  }

  drop(dataTransfer) {
    for (const listener of this.listeners.drop ?? []) {
      listener({ currentTarget: this, target: this, dataTransfer, preventDefault() {} });
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

function findAll(node, predicate, results = []) {
  if (predicate(node)) {
    results.push(node);
  }

  for (const child of node.children ?? []) {
    findAll(child, predicate, results);
  }

  return results;
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

test('Playback empty state points back to edit flow for the selected empty mixtape', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({ id: 'empty-playback', name: '빈 재생 테이프', segments: [] });
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
    playbackState: null,
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    captureNotice: null,
    settingsNotice: null,
    loading: false
  };

  const page = Playback({
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
  });
  const text = textOf(page);

  assert.match(text, /재생할 클립이 없습니다/);
  assert.match(text, /빈 재생 테이프/);
  assert.match(text, /편집 탭에서 IN\/OUT/);
});

test('Playback progress prefers live YouTube page time and does not animate while waiting', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const originalNow = Date.now;
  Date.now = () => 1700000015000;
  const sequence = makeSequence({
    id: 'sequence-live-progress',
    name: '라이브 진행률 믹스테이프',
    segments: [makeSegment({ id: 'clip-live-progress', title: '라이브 진행률 클립', videoId: 'video-live', startSeconds: 10, endSeconds: 20 })]
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
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video-live',
      title: '라이브 진행률 클립',
      url: 'https://www.youtube.com/watch?v=video-live',
      currentTime: 12,
      duration: 100
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-live-progress',
      status: 'waiting',
      startedAt: 1700000000000
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '라이브 진행률 클립',
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

    assert.equal(progressBar.dataset.progressRatio, '0.2');
    assert.match(progressBar.children[0].style.cssText, /width: 20%/);
    assert.doesNotMatch(progressBar.children[0].style.cssText, /snacktape-progress-fill/);
  } finally {
    Date.now = originalNow;
  }
});

test('Playback progress follows live YouTube time without CSS animation while playing', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const originalNow = Date.now;
  Date.now = () => 1700000019000;
  const sequence = makeSequence({
    id: 'sequence-live-rewind',
    name: '라이브 리와인드 믹스테이프',
    segments: [makeSegment({ id: 'clip-live-rewind', title: '라이브 리와인드 클립', videoId: 'video-live', startSeconds: 10, endSeconds: 20 })]
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
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video-live',
      title: '라이브 리와인드 클립',
      url: 'https://www.youtube.com/watch?v=video-live',
      currentTime: 11,
      duration: 100
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-live-rewind',
      status: 'playing',
      startedAt: 1700000000000
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '라이브 리와인드 클립',
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

    assert.equal(progressBar.dataset.progressRatio, '0.1');
    assert.match(progressBar.children[0].style.cssText, /width: 10%/);
    assert.doesNotMatch(progressBar.children[0].style.cssText, /snacktape-progress-fill/);
    assert.doesNotMatch(progressBar.children[1].style.cssText, /snacktape-progress-knob/);
  } finally {
    Date.now = originalNow;
  }
});

test('Playback progress seeks within the saved segment range', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-seek',
    name: '탐색 믹스테이프',
    segments: [makeSegment({ id: 'clip-seek', title: '탐색 클립', videoId: 'video-seek', startSeconds: 10, endSeconds: 30 })]
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
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video-seek',
      title: '탐색 클립',
      url: 'https://www.youtube.com/watch?v=video-seek',
      currentTime: 14,
      duration: 100
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-seek',
      status: 'playing',
      startedAt: 1700000000000
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '탐색 클립',
      positionText: '1 / 1',
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
    onBack: () => {},
    onPlay: () => {},
    onPause: () => {},
    onResume: () => {},
    onStop: () => {},
    onNext: () => {},
    onSeek: (seconds) => calls.push(seconds),
    onEditSequence: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });
  const progressBar = findByAriaLabel(page, '재생 진행률');

  progressBar.clickAt(50);
  progressBar.keyDown('ArrowRight');
  progressBar.keyDown('Home');
  progressBar.keyDown('End');

  assert.deepEqual(calls, [20, 15, 10, 30]);
  assert.equal(progressBar.attributes.role, 'slider');
  assert.equal(progressBar.attributes.tabindex, '0');
});

test('Playback center control pauses and resumes instead of stopping', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-pause-resume',
    name: '일시정지 믹스테이프',
    segments: [makeSegment({ id: 'clip-pause-resume', title: '일시정지 클립', videoId: 'video1' })]
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
      segmentIndex: 0,
      currentSegmentId: 'clip-pause-resume',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '일시정지 클립',
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

  const playingPage = Playback({
    state: baseState,
    onBack: () => {},
    onPlay: () => {},
    onPause: () => calls.push('pause'),
    onResume: () => calls.push('resume'),
    onStop: () => calls.push('stop'),
    onNext: () => {},
    onEditSequence: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });
  findByAriaLabel(playingPage, '일시정지').click();

  const pausedPage = Playback({
    state: {
      ...baseState,
      playbackState: {
        ...baseState.playbackState,
        status: 'paused'
      }
    },
    onBack: () => {},
    onPlay: () => {},
    onPause: () => calls.push('pause'),
    onResume: () => calls.push('resume'),
    onStop: () => calls.push('stop'),
    onNext: () => {},
    onEditSequence: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });
  findByAriaLabel(pausedPage, '재개').click();

  assert.deepEqual(calls, ['pause', 'resume']);
});

test('Playback renders zero-second OUT values as saved times, not END', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-zero',
    name: '0초 믹스테이프',
    segments: [makeSegment({ id: 'clip-zero', title: '0초 클립', startSeconds: 0, endSeconds: 0 })]
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
      currentSegmentId: 'clip-zero',
      status: 'paused',
      startedAt: 1700000000000
    },
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };

  const page = Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onStop: () => calls.push('stop'),
    onNext: () => {},
    onEditSequence: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });
  const text = textOf(page);

  assert.match(text, /00:00 → 00:00/);
  assert.doesNotMatch(text, /END/);
});

test('Playback progress and mode controls expose semantic state', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-a11y',
    name: '접근성 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '현재 클립', videoId: 'video2' })
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
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video1',
      title: '첫 클립',
      url: 'https://www.youtube.com/watch?v=video1',
      currentTime: 15,
      duration: 100
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-1',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'shuffle'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '첫 클립',
      positionText: '1 / 2',
      modeLabel: '셔플 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };

  const page = Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onStop: () => calls.push('stop'),
    onNext: () => {},
    onEditSequence: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });
  const progressBar = findByAriaLabel(page, '재생 진행률');
  const shuffleButton = findByAriaLabel(page, '셔플 재생');
  const repeatButton = findByAriaLabel(page, '현재 클립 다시 재생');

  assert.equal(progressBar.attributes['aria-valuemin'], '0');
  assert.equal(progressBar.attributes['aria-valuemax'], '10');
  assert.equal(progressBar.attributes['aria-valuenow'], '5');
  assert.equal(shuffleButton.attributes['aria-pressed'], 'true');
  assert.equal(repeatButton.attributes['aria-pressed'], 'false');
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
    onPause: () => calls.push(['pause']),
    onResume: () => calls.push(['resume']),
    onStop: () => calls.push(['stop']),
    onNext: () => calls.push(['next'])
  });

  findByAriaLabel(page, '믹스테이프로 돌아가기').click();
  findByAriaLabel(page, '셔플 재생').click();
  findByAriaLabel(page, '이전 클립').click();
  findByAriaLabel(page, '일시정지').click();
  findByAriaLabel(page, '다음 클립').click();
  findByAriaLabel(page, '현재 클립 다시 재생').click();
  findByAriaLabel(page, '다음 클립부터 순서대로 재생').click();

  assert.deepEqual(calls, [
    ['back'],
    ['play', 1, sequence.id, 'shuffle'],
    ['play', 0, sequence.id, 'sequence'],
    ['pause'],
    ['next'],
    ['play', 1, sequence.id, 'repeat'],
    ['play', 2, sequence.id, 'sequence']
  ]);
});

test('Playback queue rows separate play-from-here from repeat-this-clip', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-queue-semantics',
    name: '큐 동작 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '둘째 클립', videoId: 'video2' })
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
      segmentIndex: 0,
      currentSegmentId: 'clip-1',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'shuffle'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '첫 클립',
      positionText: '1 / 2',
      modeLabel: '셔플 재생',
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
    onPlay: (index, sequenceId, mode) => calls.push(['play', index, sequenceId, mode]),
    onPause: () => {},
    onResume: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });

  findByAriaLabel(page, '둘째 클립부터 순서대로 재생').click();
  findByAriaLabel(page, '둘째 클립만 반복 재생').click();

  assert.deepEqual(calls, [
    ['play', 1, sequence.id, 'sequence'],
    ['play', 1, sequence.id, 'repeat']
  ]);
});

test('Playback queue rows expose edit and remove actions without entering queue edit mode', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-row-actions',
    name: '행 액션 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '현재 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '제거할 클립', videoId: 'video2' })
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
      segmentIndex: 0,
      currentSegmentId: 'clip-1',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence',
      orderSegmentIds: ['clip-1', 'clip-2'],
      orderPosition: 0
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '현재 클립',
      positionText: '1 / 2',
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
    onPause: () => {},
    onResume: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onEditSegment: (sequenceId, segmentId) => calls.push(['edit-segment', sequenceId, segmentId]),
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {},
    onRemovePlaybackQueueSegment: (segmentId) => calls.push(['remove-queue', segmentId])
  });

  findByAriaLabel(page, '제거할 클립 구간 편집').click();
  findByAriaLabel(page, '제거할 클립 큐에서 제거').click();

  assert.deepEqual(calls, [
    ['edit-segment', sequence.id, 'clip-2'],
    ['remove-queue', 'clip-2']
  ]);
});

test('Playback displays target tab readiness for the active YouTube handoff', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-target-status',
    name: '탭 상태 믹스테이프',
    segments: [makeSegment({ id: 'clip-target-status', title: '탭 상태 클립', videoId: 'video-ready' })]
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
    pageInfo: {
      isYouTubeVideoPage: true,
      videoId: 'video-ready',
      title: '탭 상태 클립',
      url: 'https://www.youtube.com/watch?v=video-ready',
      currentTime: 10,
      duration: 100
    },
    videoState: null,
    playbackState: {
      sequenceId: sequence.id,
      segmentIndex: 0,
      currentSegmentId: 'clip-target-status',
      tabId: 42,
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '탭 상태 클립',
      positionText: '1 / 1',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    loading: false
  };

  const page = Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onPause: () => {},
    onResume: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });

  assert.match(textOf(page), /TAB 42/);
  assert.match(textOf(page), /CONNECTED/);
});

test('Playback edge mode buttons toggle shuffle and repeat modes', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-mode-toggle',
    name: '모드 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '현재 클립', videoId: 'video2' })
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
      mode: 'shuffle'
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '현재 클립',
      positionText: '2 / 2',
      modeLabel: '셔플 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    loading: false
  };
  const calls = [];

  const shufflePage = Playback({
    state: baseState,
    onBack: () => {},
    onPlay: (index, sequenceId, mode) => calls.push(['play', index, sequenceId, mode]),
    onStop: () => {},
    onNext: () => {}
  });
  const shuffleButton = findByAriaLabel(shufflePage, '셔플 재생');
  shuffleButton.click();

  const repeatPage = Playback({
    state: {
      ...baseState,
      playbackState: {
        ...baseState.playbackState,
        mode: 'repeat'
      }
    },
    onBack: () => {},
    onPlay: (index, sequenceId, mode) => calls.push(['play', index, sequenceId, mode]),
    onStop: () => {},
    onNext: () => {}
  });
  const repeatButton = findByAriaLabel(repeatPage, '현재 클립 다시 재생');
  assert.equal(repeatButton.attributes['aria-pressed'], 'true');
  repeatButton.click();

  assert.deepEqual(calls, [
    ['play', 1, sequence.id, 'sequence'],
    ['play', 1, sequence.id, 'sequence']
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

  assert.deepEqual(calls, [['edit', sequence.id]]);
});

test('Playback queue header exposes up-next count and explicit queue edit action', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-queue-entry',
    name: '큐 편집 믹스테이프',
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
      mode: 'sequence',
      orderSegmentIds: ['clip-1', 'clip-2', 'clip-3'],
      orderPosition: 1
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

  const page = Playback({
    state,
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: (sequenceId) => calls.push(['edit', sequenceId]),
    onBeginQueueEdit: (sequenceId) => calls.push(['queue', sequenceId]),
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });

  findByAriaLabel(page, '큐 편집').click();
  findByAriaLabel(page, '믹스테이프 편집').click();

  assert.match(textOf(page), /1 UP NEXT/);
  assert.deepEqual(calls, [
    ['queue', sequence.id],
    ['edit', sequence.id]
  ]);
});

test('Playback queue edit is disabled until a playback session is active', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-queue-inactive',
    name: '비활성 큐 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '둘째 클립', videoId: 'video2' })
    ]
  });
  const calls = [];

  const page = Playback({
    state: {
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
      playbackState: null,
      playbackDisplay: null,
      draftIn: null,
      capturePulseId: null,
      queueEdit: null,
      loading: false
    },
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onBeginQueueEdit: (sequenceId) => calls.push(sequenceId),
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });
  const queueEditButton = findByAriaLabel(page, '큐 편집');

  assert.equal(queueEditButton.disabled, true);
  queueEditButton.click();
  assert.deepEqual(calls, []);
});

test('Playback list keeps mixtape order during shuffle without dimming earlier entries', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-shuffle-queue',
    name: '랜덤 큐 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-a', title: '원본 첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-b', title: '이미 재생된 랜덤 클립', videoId: 'video2' }),
      makeSegment({ id: 'clip-c', title: '현재 랜덤 클립', videoId: 'video3' }),
      makeSegment({ id: 'clip-d', title: '다음 랜덤 클립', videoId: 'video4' })
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
      segmentIndex: 2,
      currentSegmentId: 'clip-c',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'shuffle',
      orderSegmentIds: ['clip-b', 'clip-c', 'clip-a', 'clip-d'],
      orderPosition: 1
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '현재 랜덤 클립',
      positionText: '2 / 4',
      modeLabel: '랜덤 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };

  const page = Playback({
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
  });
  const queue = findAll(page, (node) => node.dataset?.scrollKey === `playback-queue:${sequence.id}`)[0];
  const queueText = textOf(queue);
  const previousButton = findByAriaLabel(queue, '이미 재생된 랜덤 클립부터 순서대로 재생');
  const currentButton = findByAriaLabel(queue, '현재 랜덤 클립부터 순서대로 재생');

  assert.ok(queue);
  assert.match(queueText, /이미 재생된 랜덤 클립/);
  assert.match(queueText, /현재 랜덤 클립/);
  assert.match(queueText, /원본 첫 클립/);
  assert.match(queueText, /다음 랜덤 클립/);
  assert.equal(queueText.indexOf('원본 첫 클립') < queueText.indexOf('이미 재생된 랜덤 클립'), true);
  assert.equal(queueText.indexOf('이미 재생된 랜덤 클립') < queueText.indexOf('현재 랜덤 클립'), true);
  assert.equal(queueText.indexOf('현재 랜덤 클립') < queueText.indexOf('다음 랜덤 클립'), true);
  assert.notEqual(previousButton.style.opacity, '0.4');
  assert.notEqual(currentButton.style.opacity, '0.4');
});

test('Playback list shows manually applied session queue order', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-manual-session-queue',
    name: '세션 큐 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-a', title: '원본 첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-b', title: '원본 둘째 클립', videoId: 'video2' }),
      makeSegment({ id: 'clip-c', title: '앞으로 보낸 클립', videoId: 'video3' })
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
      segmentIndex: 2,
      currentSegmentId: 'clip-c',
      status: 'playing',
      startedAt: 1700000000000,
      mode: 'sequence',
      orderSegmentIds: ['clip-c', 'clip-a', 'clip-b'],
      orderPosition: 0,
      queueEdited: true
    },
    playbackDisplay: {
      sequenceName: sequence.name,
      segmentTitle: '앞으로 보낸 클립',
      positionText: '1 / 3',
      modeLabel: '순서대로 재생',
      canStop: true
    },
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };

  const page = Playback({
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
  });
  const queue = findAll(page, (node) => node.dataset?.scrollKey === `playback-queue:${sequence.id}`)[0];
  const queueText = textOf(queue);

  assert.equal(queueText.indexOf('앞으로 보낸 클립') < queueText.indexOf('원본 첫 클립'), true);
  assert.equal(queueText.indexOf('원본 첫 클립') < queueText.indexOf('원본 둘째 클립'), true);
});

test('Playback previous and next controls are disabled at queue boundaries', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-boundaries',
    name: '경계 믹스테이프',
    segments: [
      makeSegment({ id: 'clip-1', title: '첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-2', title: '마지막 클립', videoId: 'video2' })
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
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };
  const calls = [];
  const handlers = {
    onBack: () => {},
    onPlay: (index) => calls.push(index),
    onStop: () => {},
    onNext: () => calls.push('next'),
    onEditSequence: () => {},
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  };

  const firstPage = Playback({
    state: {
      ...baseState,
      playbackState: {
        sequenceId: sequence.id,
        segmentIndex: 0,
        currentSegmentId: 'clip-1',
        status: 'paused',
        startedAt: 1700000000000
      }
    },
    ...handlers
  });
  findByAriaLabel(firstPage, '이전 클립').click();

  const finalPage = Playback({
    state: {
      ...baseState,
      playbackState: {
        sequenceId: sequence.id,
        segmentIndex: 1,
        currentSegmentId: 'clip-2',
        status: 'paused',
        startedAt: 1700000000000
      }
    },
    ...handlers
  });
  findByAriaLabel(finalPage, '다음 클립').click();

  assert.equal(findByAriaLabel(firstPage, '이전 클립').disabled, true);
  assert.equal(findByAriaLabel(finalPage, '다음 클립').disabled, true);
  assert.deepEqual(calls, []);
});

test('Playback previous and next controls use edited session queue boundaries', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-edited-boundaries',
    name: '세션 큐 경계',
    segments: [
      makeSegment({ id: 'clip-a', title: '원본 첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-b', title: '세션 마지막 클립', videoId: 'video2' }),
      makeSegment({ id: 'clip-c', title: '세션 첫 클립', videoId: 'video3' })
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
    playbackDisplay: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    loading: false
  };
  const handlers = {
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
  };

  const firstSessionPage = Playback({
    state: {
      ...baseState,
      playbackState: {
        sequenceId: sequence.id,
        segmentIndex: 2,
        currentSegmentId: 'clip-c',
        status: 'playing',
        startedAt: 1700000000000,
        orderSegmentIds: ['clip-c', 'clip-a', 'clip-b'],
        orderPosition: 0,
        queueEdited: true
      }
    },
    ...handlers
  });

  const finalSessionPage = Playback({
    state: {
      ...baseState,
      playbackState: {
        sequenceId: sequence.id,
        segmentIndex: 1,
        currentSegmentId: 'clip-b',
        status: 'playing',
        startedAt: 1700000000000,
        orderSegmentIds: ['clip-c', 'clip-a', 'clip-b'],
        orderPosition: 2,
        queueEdited: true
      }
    },
    ...handlers
  });

  assert.equal(findByAriaLabel(firstSessionPage, '이전 클립').disabled, true);
  assert.equal(findByAriaLabel(finalSessionPage, '다음 클립').disabled, true);
});

test('Playback renders edited session queue exactly and starts from the displayed suffix', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-edited-queue',
    name: '세션 큐',
    segments: [
      makeSegment({ id: 'clip-a', title: '원본 첫 클립', videoId: 'video1' }),
      makeSegment({ id: 'clip-b', title: '제거된 클립', videoId: 'video2' }),
      makeSegment({ id: 'clip-c', title: '표시 첫 클립', videoId: 'video3' })
    ]
  });
  const calls = [];
  const page = Playback({
    state: {
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
        segmentIndex: 2,
        currentSegmentId: 'clip-c',
        status: 'playing',
        startedAt: 1700000000000,
        orderSegmentIds: ['clip-c', 'clip-a'],
        orderPosition: 0,
        queueEdited: true
      },
      playbackDisplay: null,
      draftIn: null,
      capturePulseId: null,
      queueEdit: null,
      loading: false
    },
    onBack: () => {},
    onPlay: (...args) => calls.push(['play', ...args]),
    onPlayQueueFrom: (...args) => calls.push(['queue', ...args]),
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {},
    onRemovePlaybackQueueSegment: () => {}
  });

  assert.match(textOf(page), /표시 첫 클립/);
  assert.match(textOf(page), /원본 첫 클립/);
  assert.doesNotMatch(textOf(page), /제거된 클립/);

  findByAriaLabel(page, '원본 첫 클립부터 순서대로 재생').click();

  assert.deepEqual(calls, [['queue', sequence.id, 'clip-a', ['clip-a']]]);
});

test('Playback renders runtime playback errors in the Now Playing header', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-runtime-error',
    name: '오류 믹스테이프',
    segments: [makeSegment({ id: 'clip-runtime-error', title: '오류 클립' })]
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
    playbackState: null,
    playbackDisplay: null,
    playbackNotice: {
      kind: 'error',
      message: '재생을 시작할 수 없습니다. runtime failed',
      recovery: {
        type: 'start',
        sequenceId: sequence.id,
        startIndex: 0,
        mode: 'sequence'
      }
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
    onStop: () => calls.push('stop'),
    onNext: () => {},
    onRetryPlayback: () => calls.push('retry'),
    onEditSequence: () => {},
    onBeginQueueEdit: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: () => {},
    onRemoveQueueSegment: () => {}
  });

  assert.match(textOf(page), /재생을 시작할 수 없습니다\. runtime failed/);
  findByAriaLabel(page, '재생 다시 연결').click();
  findByAriaLabel(page, '재생 정지').click();

  assert.deepEqual(calls, ['retry', 'stop']);
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

test('Playback queue drag reorder survives a rerender by using dataTransfer', async () => {
  installDomShim();
  const { Playback } = await import('../.tmp-tests/src/screens/Playback.js');
  const sequence = makeSequence({
    id: 'sequence-drag',
    name: '드래그 믹스테이프',
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
    queueEdit: {
      sequenceId: sequence.id,
      segmentIds: ['clip-1', 'clip-2', 'clip-3']
    },
    loading: false
  };
  const moves = [];
  const handlers = {
    onBack: () => {},
    onPlay: () => {},
    onStop: () => {},
    onNext: () => {},
    onEditSequence: () => {},
    onCancelQueueEdit: () => {},
    onSaveQueueEdit: () => {},
    onMoveQueueSegment: (fromIndex, toIndex) => moves.push([fromIndex, toIndex]),
    onRemoveQueueSegment: () => {}
  };
  const dataTransferValues = new Map();
  const dataTransfer = {
    setData: (type, value) => dataTransferValues.set(type, value),
    getData: (type) => dataTransferValues.get(type) ?? ''
  };

  const firstRender = Playback({ state, ...handlers });
  findAll(firstRender, (node) => node.draggable)[0].dragStart(dataTransfer);

  const secondRender = Playback({ state, ...handlers });
  findAll(secondRender, (node) => node.draggable)[2].drop(dataTransfer);

  assert.deepEqual(moves, [[0, 2]]);
});
