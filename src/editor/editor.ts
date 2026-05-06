import { formatSeconds, parseTimeToSeconds } from '../shared/time.js';
import {
  createDefaultSequence,
  createId,
  deleteSequence as deleteSequenceFromStorage,
  loadStore,
  normalizeImportedStore,
  saveStore,
  selectSequence
} from '../shared/storage.js';
import type { Segment, Sequence, SnackTapeStore } from '../shared/types.js';
import { moveSegmentDown, moveSegmentUp } from '../shared/reorder.js';
import { validateSegment } from '../shared/validation.js';

const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const newSequenceName = document.querySelector<HTMLInputElement>('#newSequenceName')!;
const createSequenceButton = document.querySelector<HTMLButtonElement>('#createSequence')!;
const sequenceList = document.querySelector<HTMLDivElement>('#sequenceList')!;
const renameSequenceName = document.querySelector<HTMLInputElement>('#renameSequenceName')!;
const renameSequenceButton = document.querySelector<HTMLButtonElement>('#renameSequence')!;
const deleteSequenceButton = document.querySelector<HTMLButtonElement>('#deleteSequence')!;
const activeSequenceName = document.querySelector<HTMLHeadingElement>('#activeSequenceName')!;
const segmentCount = document.querySelector<HTMLParagraphElement>('#segmentCount')!;
const segmentList = document.querySelector<HTMLDivElement>('#segmentList')!;
const exportStoreButton = document.querySelector<HTMLButtonElement>('#exportStore')!;
const exportSequenceButton = document.querySelector<HTMLButtonElement>('#exportSequence')!;
const importJsonButton = document.querySelector<HTMLButtonElement>('#importJson')!;
const jsonText = document.querySelector<HTMLTextAreaElement>('#jsonText')!;

let store: SnackTapeStore;
let editingSegmentId: string | null = null;

function setStatus(message: string, kind: 'info' | 'error' = 'info'): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', kind === 'error');
}

function selectedSequence(): Sequence | null {
  return store.sequences.find((sequence) => sequence.id === store.selectedSequenceId) ?? store.sequences[0] ?? null;
}

function makeButton(label: string, onClick: () => void | Promise<void>, className?: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (className) {
    button.className = className;
  }
  button.addEventListener('click', () => void onClick());
  return button;
}

function makeMeta(label: string, value: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('strong');
  labelEl.textContent = label;
  valueEl.textContent = value;
  wrapper.append(labelEl, valueEl);
  return wrapper;
}

function confirmUnsavedChanges(): boolean {
  if (!editingSegmentId) {
    return true;
  }

  return window.confirm('저장하지 않은 수정이 있습니다. 계속할까요?');
}

async function persistStore(nextStore: SnackTapeStore, message: string): Promise<void> {
  await saveStore(nextStore);
  store = await loadStore();
  render();
  setStatus(message);
}

async function persistSequence(sequence: Sequence, message: string): Promise<void> {
  await persistStore(
    {
      ...store,
      sequences: store.sequences.map((item) => (item.id === sequence.id ? sequence : item))
    },
    message
  );
}

function renderSequences(): void {
  sequenceList.replaceChildren();

  for (const sequence of store.sequences) {
    const button = makeButton(`${sequence.name} (${sequence.segments.length})`, async () => {
      if (!confirmUnsavedChanges()) {
        return;
      }

      await selectSequence(sequence.id);
      store = await loadStore();
      editingSegmentId = null;
      render();
      setStatus('선택한 시퀀스를 바꿨습니다.');
    }, 'sequence-button');

    if (sequence.id === store.selectedSequenceId) {
      button.classList.add('active');
    }

    sequenceList.append(button);
  }
}

function renderSegmentReadOnly(sequence: Sequence, segment: Segment, index: number): HTMLElement {
  const body = document.createElement('div');
  body.className = 'segment-body';

  const title = document.createElement('h3');
  title.className = 'segment-title';
  title.textContent = segment.title;

  const meta = document.createElement('div');
  meta.className = 'segment-meta';
  meta.append(
    makeMeta('영상 ID', segment.videoId),
    makeMeta('구간', `${formatSeconds(segment.startSeconds)} - ${segment.endSeconds && segment.endSeconds > 0 ? formatSeconds(segment.endSeconds) : '영상 끝까지'}`),
    makeMeta('원본 링크', segment.originalUrl),
    makeMeta('순서', `${index + 1}`)
  );

  const actions = document.createElement('div');
  actions.className = 'segment-actions';
  const up = makeButton('위로', () => persistSequence(moveSegmentUp(sequence, segment.id), '순서를 바꿨습니다.'));
  const down = makeButton('아래로', () => persistSequence(moveSegmentDown(sequence, segment.id), '순서를 바꿨습니다.'));
  up.disabled = index === 0;
  down.disabled = index === sequence.segments.length - 1;

  actions.append(
    up,
    down,
    makeButton('수정', () => {
      editingSegmentId = segment.id;
      render();
    }),
    makeButton('삭제', async () => {
      const updated = {
        ...sequence,
        segments: sequence.segments.filter((item) => item.id !== segment.id),
        updatedAt: Date.now()
      };
      await persistSequence(updated, '구간을 삭제했습니다.');
    }, 'danger')
  );

  body.append(title, meta, actions);
  return body;
}

function renderSegmentEditor(sequence: Sequence, segment: Segment): HTMLElement {
  const body = document.createElement('div');
  body.className = 'segment-body';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = segment.title;
  titleInput.placeholder = '제목';

  const startInput = document.createElement('input');
  startInput.type = 'text';
  startInput.value = formatSeconds(segment.startSeconds);
  startInput.placeholder = '시작 시간';

  const endInput = document.createElement('input');
  endInput.type = 'text';
  endInput.value = segment.endSeconds && segment.endSeconds > 0 ? formatSeconds(segment.endSeconds) : '';
  endInput.placeholder = '끝 시간 비우면 영상 끝까지';

  const titleLabel = document.createElement('label');
  titleLabel.textContent = '제목';
  titleLabel.append(titleInput);

  const startLabel = document.createElement('label');
  startLabel.textContent = '시작';
  startLabel.append(startInput);

  const endLabel = document.createElement('label');
  endLabel.textContent = '끝';
  endLabel.append(endInput);

  const editGrid = document.createElement('div');
  editGrid.className = 'edit-grid';
  editGrid.append(titleLabel, startLabel, endLabel);

  const actions = document.createElement('div');
  actions.className = 'segment-actions';
  actions.append(
    makeButton('저장', async () => {
      const startSeconds = parseTimeToSeconds(startInput.value);
      const endValue = endInput.value.trim() ? parseTimeToSeconds(endInput.value) : null;

      if (startSeconds === null || (endInput.value.trim() && endValue === null)) {
        setStatus('시간 형식을 확인해주세요.', 'error');
        return;
      }

      const updatedSegment: Segment = {
        ...segment,
        title: titleInput.value.trim(),
        startSeconds,
        endSeconds: endValue,
        updatedAt: Date.now()
      };

      const errors = validateSegment(updatedSegment);
      if (errors.length > 0) {
        setStatus(errors[0], 'error');
        return;
      }

      const updatedSequence = {
        ...sequence,
        segments: sequence.segments.map((item) => (item.id === segment.id ? updatedSegment : item)),
        updatedAt: Date.now()
      };

      editingSegmentId = null;
      await persistSequence(updatedSequence, '구간을 저장했습니다.');
    }),
    makeButton('취소', () => {
      editingSegmentId = null;
      render();
    })
  );

  body.append(editGrid, actions);
  return body;
}

function renderSegments(sequence: Sequence | null): void {
  segmentList.replaceChildren();

  if (!sequence || sequence.segments.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '구간이 없습니다.';
    segmentList.append(empty);
    return;
  }

  sequence.segments.forEach((segment, index) => {
    const card = document.createElement('article');
    card.className = 'segment-card';

    const thumbnail = document.createElement('img');
    thumbnail.className = 'thumbnail';
    thumbnail.src = `https://img.youtube.com/vi/${encodeURIComponent(segment.videoId)}/mqdefault.jpg`;
    thumbnail.alt = `${segment.title} 썸네일`;
    thumbnail.loading = 'lazy';

    const body = editingSegmentId === segment.id
      ? renderSegmentEditor(sequence, segment)
      : renderSegmentReadOnly(sequence, segment, index);

    card.append(thumbnail, body);
    segmentList.append(card);
  });
}

function render(): void {
  const sequence = selectedSequence();
  renderSequences();
  renameSequenceName.value = sequence?.name ?? '';
  activeSequenceName.textContent = sequence?.name ?? '선택한 시퀀스';
  segmentCount.textContent = sequence ? `${sequence.segments.length}개 구간` : '';
  renderSegments(sequence);
}

createSequenceButton.addEventListener('click', async () => {
  if (!confirmUnsavedChanges()) {
    return;
  }

  const name = newSequenceName.value.trim();
  if (!name) {
    setStatus('시퀀스 이름을 입력해주세요.', 'error');
    return;
  }

  const sequence = createDefaultSequence();
  sequence.id = createId('sequence');
  sequence.name = name;
  sequence.updatedAt = Date.now();
  sequence.createdAt = sequence.updatedAt;

  await persistStore({
    sequences: [...store.sequences, sequence],
    selectedSequenceId: sequence.id
  }, '시퀀스를 만들었습니다.');
  newSequenceName.value = '';
});

renameSequenceButton.addEventListener('click', async () => {
  const sequence = selectedSequence();
  const name = renameSequenceName.value.trim();
  if (!sequence || !name) {
    setStatus('시퀀스 이름을 입력해주세요.', 'error');
    return;
  }

  await persistSequence({
    ...sequence,
    name,
    updatedAt: Date.now()
  }, '이름을 변경했습니다.');
});

deleteSequenceButton.addEventListener('click', async () => {
  if (!confirmUnsavedChanges()) {
    return;
  }

  const sequence = selectedSequence();
  if (!sequence) {
    return;
  }

  if (!window.confirm(`"${sequence.name}" 시퀀스를 삭제할까요? 저장된 구간 ${sequence.segments.length}개도 함께 사라집니다.`)) {
    return;
  }

  await deleteSequenceFromStorage(sequence.id);
  store = await loadStore();
  editingSegmentId = null;
  render();
  setStatus('시퀀스를 삭제했습니다.');
});

exportStoreButton.addEventListener('click', () => {
  jsonText.value = JSON.stringify(store, null, 2);
  setStatus('전체 JSON 내보내기 결과를 만들었습니다.');
});

exportSequenceButton.addEventListener('click', () => {
  const sequence = selectedSequence();
  if (!sequence) {
    setStatus('선택한 시퀀스가 없습니다.', 'error');
    return;
  }

  jsonText.value = JSON.stringify(sequence, null, 2);
  setStatus('선택 시퀀스 JSON 내보내기 결과를 만들었습니다.');
});

importJsonButton.addEventListener('click', async () => {
  if (!confirmUnsavedChanges()) {
    return;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText.value);
  } catch {
    setStatus('JSON 형식을 확인해주세요.', 'error');
    return;
  }

  const imported = normalizeImportedStore(parsed);
  if (!imported) {
    setStatus('가져올 수 있는 SnackTape JSON이 아닙니다.', 'error');
    return;
  }

  const usedSequenceIds = new Set(store.sequences.map((sequence) => sequence.id));
  const usedSegmentIds = new Set(store.sequences.flatMap((sequence) => sequence.segments.map((segment) => segment.id)));
  const timestamp = Date.now();
  const importedSequences = imported.sequences.map((sequence) => {
    const sequenceId = usedSequenceIds.has(sequence.id) ? createId('sequence') : sequence.id;
    usedSequenceIds.add(sequenceId);

    const segments = sequence.segments.map((segment) => {
      const segmentId = usedSegmentIds.has(segment.id) ? createId('segment') : segment.id;
      usedSegmentIds.add(segmentId);
      return {
        ...segment,
        id: segmentId,
        updatedAt: timestamp
      };
    });

    return {
      ...sequence,
      id: sequenceId,
      segments,
      updatedAt: timestamp
    };
  });

  await saveStore({
    sequences: [...store.sequences, ...importedSequences],
    selectedSequenceId: importedSequences[0]?.id ?? store.selectedSequenceId
  });
  store = await loadStore();
  editingSegmentId = null;
  render();
  setStatus('JSON 가져오기를 완료했습니다. 기존 목록 뒤에 추가했습니다.');
});

async function init(): Promise<void> {
  store = await loadStore();
  render();
  setStatus('편집할 시퀀스를 선택하세요.');
}

void init().catch(() => {
  setStatus('편집기를 열 수 없습니다.', 'error');
});
