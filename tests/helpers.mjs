export function makeSegment(overrides = {}) {
  const now = 1700000000000;
  return {
    id: 'segment-1',
    videoId: 'abc123XYZ_1',
    originalUrl: 'https://www.youtube.com/watch?v=abc123XYZ_1',
    title: '테스트 영상',
    startSeconds: 10,
    endSeconds: 20,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function makeSequence(overrides = {}) {
  const now = 1700000000000;
  return {
    id: 'sequence-1',
    name: '테스트 시퀀스',
    segments: [makeSegment({ id: 'a' }), makeSegment({ id: 'b' }), makeSegment({ id: 'c' })],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function makeSettings(overrides = {}) {
  return {
    accentKey: 'peach',
    language: 'ko',
    autoNext: true,
    fadeOut: true,
    shuffleByDefault: false,
    shortcutIn: 'Alt+I',
    shortcutOut: 'Alt+O',
    autoTitleFromCaptions: true,
    ...overrides
  };
}

export function makeAppState(overrides = {}) {
  const {
    sequences,
    selectedSequenceId,
    settings,
    store,
    ...stateOverrides
  } = overrides;
  const resolvedSequences = sequences ?? store?.sequences ?? [];
  const resolvedSelectedSequenceId = selectedSequenceId ?? store?.selectedSequenceId ?? resolvedSequences[0]?.id ?? null;
  const resolvedStore = store === null ? null : {
    ...(store ?? {}),
    sequences: resolvedSequences,
    selectedSequenceId: resolvedSelectedSequenceId
  };

  return {
    route: 'home',
    store: resolvedStore,
    settings: makeSettings(settings),
    pageInfo: null,
    videoState: null,
    playbackState: null,
    playbackDisplay: null,
    playbackNotice: null,
    draftIn: null,
    capturePulseId: null,
    queueEdit: null,
    segmentEdit: null,
    renameEdit: null,
    captureNotice: null,
    settingsNotice: null,
    homeSearch: '',
    homeSort: 'manual',
    loading: false,
    ...stateOverrides
  };
}
