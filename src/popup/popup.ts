import { formatSeconds } from '../shared/time.js';
import {
  clearSegmentDraft,
  createId,
  loadStore,
  loadSegmentDraft,
  saveSegmentDraft,
  saveStore,
  selectSequence
} from '../shared/storage.js';
import type { PageInfo, Segment, SnackTapeMessage, SnackTapeResponse, SnackTapeStore } from '../shared/types.js';
import { validateSegment, validateSequence } from '../shared/validation.js';
import { parseYouTubeVideoId } from '../shared/youtube.js';

const pageWarning = document.querySelector<HTMLDivElement>('#pageWarning')!;
const videoTitle = document.querySelector<HTMLParagraphElement>('#videoTitle')!;
const videoMeta = document.querySelector<HTMLParagraphElement>('#videoMeta')!;
const currentTime = document.querySelector<HTMLElement>('#currentTime')!;
const sequenceSelect = document.querySelector<HTMLSelectElement>('#sequenceSelect')!;
const draftStartEl = document.querySelector<HTMLElement>('#draftStart')!;
const draftEndEl = document.querySelector<HTMLElement>('#draftEnd')!;
const captureStart = document.querySelector<HTMLButtonElement>('#captureStart')!;
const captureEnd = document.querySelector<HTMLButtonElement>('#captureEnd')!;
const addSegment = document.querySelector<HTMLButtonElement>('#addSegment')!;
const startPlayback = document.querySelector<HTMLButtonElement>('#startPlayback')!;
const openEditor = document.querySelector<HTMLButtonElement>('#openEditor')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;

let store: SnackTapeStore;
let pageInfo: PageInfo | null = null;
let draftStart: number | null = null;
let draftEnd: number | null = null;

function setStatus(message: string, kind: 'info' | 'error' = 'info'): void {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', kind === 'error');
}

function selectedSequence() {
  return store.sequences.find((sequence) => sequence.id === store.selectedSequenceId) ?? store.sequences[0] ?? null;
}

function renderDraft(): void {
  draftStartEl.textContent = draftStart === null ? '아직 찍지 않음' : formatSeconds(draftStart);
  draftEndEl.textContent = draftEnd === null ? '영상 끝까지' : formatSeconds(draftEnd);
}

async function persistDraft(): Promise<void> {
  if (!pageInfo?.videoId) {
    return;
  }

  if (draftStart === null && draftEnd === null) {
    await clearSegmentDraft(pageInfo.videoId);
    return;
  }

  await saveSegmentDraft({
    videoId: pageInfo.videoId,
    startSeconds: draftStart,
    endSeconds: draftEnd,
    updatedAt: Date.now()
  });
}

async function restoreDraftForCurrentPage(): Promise<void> {
  if (!pageInfo?.videoId) {
    draftStart = null;
    draftEnd = null;
    renderDraft();
    return;
  }

  const draft = await loadSegmentDraft(pageInfo.videoId);
  draftStart = draft?.startSeconds ?? null;
  draftEnd = draft?.endSeconds ?? null;
  renderDraft();
}

function renderSequences(): void {
  sequenceSelect.replaceChildren();

  for (const sequence of store.sequences) {
    const option = document.createElement('option');
    option.value = sequence.id;
    option.textContent = `${sequence.name} (${sequence.segments.length})`;
    option.selected = sequence.id === store.selectedSequenceId;
    sequenceSelect.append(option);
  }
}

function renderPageInfo(): void {
  const usable = Boolean(pageInfo?.isYouTubeVideoPage && pageInfo.videoId);
  const sequence = selectedSequence();
  pageWarning.classList.toggle('hidden', usable);
  videoTitle.textContent = usable ? pageInfo?.title || '제목을 읽는 중...' : 'YouTube 영상 페이지가 아닙니다.';
  videoMeta.textContent = usable && pageInfo?.videoId ? `영상 ID: ${pageInfo.videoId}` : '구간 캡처는 YouTube 영상 페이지에서 사용할 수 있어요.';
  currentTime.textContent = usable && pageInfo?.currentTime !== null && pageInfo?.currentTime !== undefined ? formatSeconds(pageInfo.currentTime) : '--:--';

  captureStart.disabled = !usable;
  captureEnd.disabled = !usable;
  addSegment.disabled = !usable;
  startPlayback.disabled = !sequence || sequence.segments.length === 0;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] ?? null;
}

function sendTabMessage<T>(tabId: number, message: SnackTapeMessage): Promise<SnackTapeResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: SnackTapeResponse<T> | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response ?? { ok: true });
    });
  });
}

function sendRuntimeMessage(message: SnackTapeMessage): Promise<SnackTapeResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: SnackTapeResponse | undefined) => {
      const error = chrome.runtime.lastError;
      if (error) {
        resolve({ ok: false, error: '확장 프로그램과 연결할 수 없습니다.' });
        return;
      }

      resolve(response ?? { ok: true });
    });
  });
}

async function refreshPageInfo(): Promise<void> {
  const tab = await getActiveTab();
  const tabUrl = tab?.url ?? '';
  const fallbackVideoId = parseYouTubeVideoId(tabUrl);
  let isWatchPage = false;

  try {
    isWatchPage = Boolean(fallbackVideoId && new URL(tabUrl).pathname === '/watch');
  } catch {
    isWatchPage = false;
  }

  pageInfo = {
    isYouTubeVideoPage: isWatchPage,
    videoId: fallbackVideoId,
    title: tab?.title?.replace(/\s+-\s+YouTube$/, '') ?? '',
    url: tabUrl,
    currentTime: null,
    duration: null
  };

  if (tab?.id && fallbackVideoId) {
    try {
      const response = await sendTabMessage<PageInfo>(tab.id, { type: 'GET_PAGE_INFO' });
      if (response.ok && response.data) {
        pageInfo = response.data;
      }
    } catch {
      // Fallback tab data still lets the popup explain the current state.
    }
  }

  renderPageInfo();
}

async function captureCurrentTime(target: 'start' | 'end'): Promise<void> {
  const tab = await getActiveTab();
  if (!tab?.id || !pageInfo?.videoId) {
    setStatus('YouTube 영상 페이지에서 사용할 수 있어요.', 'error');
    return;
  }

  try {
    const response = await sendTabMessage<number | null>(tab.id, { type: 'GET_CURRENT_TIME' });
    const captured = response.data;
    if (!response.ok || captured === null || captured === undefined) {
      setStatus('현재 시간을 읽을 수 없습니다.', 'error');
      return;
    }

    if (target === 'start') {
      draftStart = captured;
      if (draftEnd !== null && draftEnd <= draftStart) {
        draftEnd = null;
      }
      setStatus('시작점을 찍었습니다.');
    } else {
      if (draftStart !== null && captured <= draftStart) {
        draftEnd = null;
        renderDraft();
        setStatus('끝점은 시작점보다 뒤에 있어야 합니다.', 'error');
        return;
      }
      draftEnd = captured;
      setStatus('끝점을 찍었습니다.');
    }

    renderDraft();
    await persistDraft();
    await refreshPageInfo();
  } catch {
    setStatus('현재 시간을 읽을 수 없습니다.', 'error');
  }
}

async function addCurrentSegment(): Promise<void> {
  const sequence = selectedSequence();
  if (!sequence || !pageInfo?.videoId) {
    setStatus('YouTube 영상 페이지에서 사용할 수 있어요.', 'error');
    return;
  }

  if (draftStart === null) {
    setStatus('시작점을 먼저 찍어주세요.', 'error');
    return;
  }

  if (draftEnd !== null && draftEnd <= draftStart) {
    setStatus('끝점은 시작점보다 뒤에 있어야 합니다.', 'error');
    return;
  }

  const timestamp = Date.now();
  const segment: Segment = {
    id: createId('segment'),
    videoId: pageInfo.videoId,
    originalUrl: pageInfo.url,
    title: pageInfo.title || `영상 ${pageInfo.videoId}`,
    startSeconds: draftStart,
    endSeconds: draftEnd,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const errors = validateSegment(segment);
  if (errors.length > 0) {
    setStatus(errors[0], 'error');
    return;
  }

  const updatedSequence = {
    ...sequence,
    segments: [...sequence.segments, segment],
    updatedAt: timestamp
  };

  await saveStore({
    ...store,
    sequences: store.sequences.map((item) => (item.id === updatedSequence.id ? updatedSequence : item))
  });
  await clearSegmentDraft(pageInfo.videoId);
  store = await loadStore();
  draftStart = null;
  draftEnd = null;
  renderSequences();
  renderDraft();
  setStatus(`구간을 추가했습니다. (${updatedSequence.name})`);
}

async function startSelectedSequence(): Promise<void> {
  const sequence = selectedSequence();
  if (!sequence) {
    setStatus('재생할 구간이 없습니다.', 'error');
    return;
  }

  const errors = validateSequence(sequence);
  if (errors.length > 0) {
    setStatus(errors[0], 'error');
    return;
  }

  const response = await sendRuntimeMessage({
    type: 'START_SEQUENCE',
    sequenceId: sequence.id,
    startIndex: 0
  });

  setStatus(response.ok ? '이어보기를 시작합니다.' : response.error ?? '재생을 시작할 수 없습니다.', response.ok ? 'info' : 'error');
}

sequenceSelect.addEventListener('change', async () => {
  await selectSequence(sequenceSelect.value);
  store = await loadStore();
  renderSequences();
  setStatus('선택한 시퀀스를 바꿨습니다.');
});

captureStart.addEventListener('click', () => void captureCurrentTime('start'));
captureEnd.addEventListener('click', () => void captureCurrentTime('end'));
addSegment.addEventListener('click', () => void addCurrentSegment());
startPlayback.addEventListener('click', () => void startSelectedSequence());
openEditor.addEventListener('click', async () => {
  const response = await sendRuntimeMessage({ type: 'OPEN_EDITOR' });
  if (!response.ok) {
    setStatus('편집기를 열 수 없습니다.', 'error');
  }
});

async function refreshCurrentTime(): Promise<void> {
  if (!pageInfo?.isYouTubeVideoPage || !pageInfo.videoId) {
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  try {
    const response = await sendTabMessage<number | null>(tab.id, { type: 'GET_CURRENT_TIME' });
    if (response.ok && response.data !== null && response.data !== undefined) {
      pageInfo = {
        ...pageInfo,
        currentTime: response.data
      };
      renderPageInfo();
    }
  } catch {
    // Keep the last readable time while YouTube is navigating.
  }
}

async function init(): Promise<void> {
  store = await loadStore();
  renderSequences();
  renderDraft();
  await refreshPageInfo();
  await restoreDraftForCurrentPage();
  setStatus(pageInfo?.isYouTubeVideoPage ? '시작점과 끝점을 찍어 구간을 추가해보세요.' : '편집 열기 또는 저장된 시퀀스 이어보기를 사용할 수 있습니다.');
  window.setInterval(() => void refreshCurrentTime(), 1000);
}

void init().catch(() => {
  setStatus('초기화할 수 없습니다.', 'error');
});
