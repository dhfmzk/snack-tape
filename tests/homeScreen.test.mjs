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
    this.value = '';
    this.disabled = false;
    this.selected = false;
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
      listener({ target: this });
    }
  }

  input() {
    for (const listener of this.listeners.input ?? []) {
      listener({ target: this });
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

function findByScrollKey(node, key) {
  if (node.dataset?.scrollKey === key) {
    return node;
  }

  for (const child of node.children ?? []) {
    const found = findByScrollKey(child, key);
    if (found) {
      return found;
    }
  }

  return null;
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

  const list = findByScrollKey(page, 'home-mixtapes');
  const firstCard = list.children[0];

  assert.equal(list.dataset.scrollKey, 'home-mixtapes');
  assert.equal(list.style.overflow, 'auto');
  assert.equal(list.style.minHeight, '0');
  assert.equal(firstCard.style.flexShrink, '0');
});

test('Home mixtape cards keep relaxed spacing for scan and tap targets', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const sequence = makeSequence({
    id: 'sequence-spacing',
    name: 'ASMR 조각 모음',
    segments: [makeSegment({ id: 'clip-1', startSeconds: 0, endSeconds: 130 })]
  });

  const page = Home({
    state: homeState([sequence]),
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });

  const controls = page.children[0];
  const list = findByScrollKey(page, 'home-mixtapes');
  const firstCard = list.children[0];
  const cover = firstCard.children[0];
  const body = firstCard.children[1];
  const playButton = findAllByAriaLabel(page, 'ASMR 조각 모음 재생')[0];

  assert.equal(controls.style.padding, '18px 18px 16px');
  assert.equal(controls.style.gap, '12px');
  assert.equal(controls.style.gridTemplateColumns, 'minmax(0, 1fr) 132px');
  assert.equal(list.style.padding, '0 18px 86px');
  assert.equal(list.style.gap, '18px');
  assert.equal(firstCard.style.borderRadius, '12px');
  assert.equal(cover.style.height, '124px');
  assert.equal(body.style.padding, '18px 20px 20px');
  assert.equal(playButton.style.width, '40px');
  assert.equal(playButton.style.height, '40px');
});

test('Home removes the top header and floats the new tape action', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const sequence = makeSequence({
    id: 'sequence-fab',
    name: 'FAB 확인',
    segments: [makeSegment({ id: 'clip-1' })]
  });

  const page = Home({
    state: homeState([sequence]),
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });
  const newTape = findAllByAriaLabel(page, '새 테이프 만들기')[0];

  assert.equal(page.children.length, 3);
  assert.equal(page.children[0].tagName, 'DIV');
  assert.equal(page.children[1].dataset.scrollKey, 'home-mixtapes');
  assert.equal(newTape.style.position, 'absolute');
  assert.equal(newTape.style.right, '22px');
  assert.equal(newTape.style.bottom, '22px');
  assert.doesNotMatch(textOf(page), /내 믹스테이프/);
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

test('Home exposes direct mixtape card actions', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const calls = [];
  const sequence = makeSequence({
    id: 'sequence-actions',
    name: '관리할 테이프',
    segments: [makeSegment({ id: 'clip-1' })]
  });

  const page = Home({
    state: homeState([sequence]),
    onCreate: () => {},
    onOpenSequence: (sequenceId) => calls.push(['open', sequenceId]),
    onPlaySequence: (sequenceId) => calls.push(['play', sequenceId]),
    onEditSequence: (sequenceId) => calls.push(['edit', sequenceId]),
    onRenameSequence: (sequenceId) => calls.push(['rename', sequenceId]),
    onDuplicateSequence: (sequenceId) => calls.push(['duplicate', sequenceId]),
    onDeleteSequence: (sequenceId) => calls.push(['delete', sequenceId]),
    onMergeSequence: (sourceId, targetId) => calls.push(['merge', sourceId, targetId])
  });

  findAllByAriaLabel(page, '관리할 테이프 편집')[0].click();
  findAllByAriaLabel(page, '관리할 테이프 이름 변경')[0].click();
  findAllByAriaLabel(page, '관리할 테이프 복제')[0].click();
  findAllByAriaLabel(page, '관리할 테이프 삭제')[0].click();

  assert.deepEqual(calls, [
    ['edit', 'sequence-actions'],
    ['rename', 'sequence-actions'],
    ['duplicate', 'sequence-actions'],
    ['delete', 'sequence-actions']
  ]);
});

test('Home search and sort controls are wired to state callbacks', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const calls = [];
  const state = {
    ...homeState([
      makeSequence({ id: 'a', name: 'Zeta', updatedAt: 1, segments: [makeSegment({ id: 'a1' })] }),
      makeSequence({ id: 'b', name: 'Alpha', updatedAt: 2, segments: [makeSegment({ id: 'b1' }), makeSegment({ id: 'b2' })] })
    ]),
    homeSearch: 'alp',
    homeSort: 'name'
  };

  const page = Home({
    state,
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {},
    onHomeSearch: (query) => calls.push(['search', query]),
    onHomeSort: (sort) => calls.push(['sort', sort])
  });

  const text = textOf(page);
  const search = findAllByAriaLabel(page, '믹스테이프 검색')[0];
  const sort = findAllByAriaLabel(page, '믹스테이프 정렬')[0];

  assert.match(text, /Alpha/);
  assert.equal(findByScrollKey(page, 'home-mixtapes').children.length, 1);
  assert.equal(search.value, 'alp');
  assert.equal(sort.value, 'name');

  search.value = 'z';
  search.input();
  sort.value = 'clipCount';
  sort.change();

  assert.deepEqual(calls, [
    ['search', 'z'],
    ['sort', 'clipCount']
  ]);
});

test('Home manual sort exposes mixtape order controls only in manual mode', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const calls = [];
  const first = makeSequence({ id: 'first', name: '첫 테이프', segments: [makeSegment({ id: 'first-clip' })] });
  const second = makeSequence({ id: 'second', name: '둘째 테이프', segments: [makeSegment({ id: 'second-clip' })] });

  const manualPage = Home({
    state: {
      ...homeState([first, second]),
      homeSort: 'manual'
    },
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {},
    onMoveMixtape: (sequenceId, direction) => calls.push([sequenceId, direction])
  });
  const firstUp = findAllByAriaLabel(manualPage, '첫 테이프 위로 이동')[0];
  const firstDown = findAllByAriaLabel(manualPage, '첫 테이프 아래로 이동')[0];
  const secondUp = findAllByAriaLabel(manualPage, '둘째 테이프 위로 이동')[0];
  const secondDown = findAllByAriaLabel(manualPage, '둘째 테이프 아래로 이동')[0];

  assert.equal(firstUp.disabled, true);
  assert.equal(firstDown.disabled, false);
  assert.equal(secondUp.disabled, false);
  assert.equal(secondDown.disabled, true);

  firstDown.click();
  secondUp.click();

  assert.deepEqual(calls, [
    ['first', 'down'],
    ['second', 'up']
  ]);

  const sortedPage = Home({
    state: {
      ...homeState([first, second]),
      homeSort: 'name'
    },
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {},
    onMoveMixtape: () => {}
  });

  assert.equal(findAllByAriaLabel(sortedPage, '첫 테이프 아래로 이동').length, 0);

  const unwiredPage = Home({
    state: {
      ...homeState([first, second]),
      homeSort: 'manual'
    },
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {}
  });

  assert.equal(findAllByAriaLabel(unwiredPage, '첫 테이프 아래로 이동').length, 0);
});

test('Home merge control targets another mixtape', async () => {
  installDomShim();
  const { Home } = await import('../.tmp-tests/src/screens/Home.js');
  const calls = [];
  const source = makeSequence({ id: 'source', name: '합칠 테이프', segments: [makeSegment({ id: 'source-clip' })] });
  const target = makeSequence({ id: 'target', name: '대상 테이프', segments: [makeSegment({ id: 'target-clip' })] });

  const page = Home({
    state: homeState([source, target]),
    onCreate: () => {},
    onOpenSequence: () => {},
    onPlaySequence: () => {},
    onMergeSequence: (sourceId, targetId) => calls.push([sourceId, targetId])
  });

  const select = findAllByAriaLabel(page, '합칠 테이프 병합 대상')[0];
  select.value = 'target';
  select.change();
  findAllByAriaLabel(page, '합칠 테이프 병합')[0].click();

  assert.deepEqual(calls, [['source', 'target']]);
});
