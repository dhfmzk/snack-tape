import { PanelFrame } from './components/PanelFrame.js';
import { el } from './components/dom.js';
import { Capture } from './screens/Capture.js';
import { Detail } from './screens/Detail.js';
import { Home } from './screens/Home.js';
import { Playback } from './screens/Playback.js';
import { Settings } from './screens/Settings.js';
import type { AppState, SnackTapeAppStore } from './state/store.js';

function screenFor(state: AppState, store: SnackTapeAppStore): HTMLElement {
  if (state.loading) {
    return el('div', { className: 'screen', dataset: { scrollKey: 'loading-screen' } }, el('p', { className: 'soft-empty', text: '불러오는 중...' }));
  }

  if (state.route === 'capture') {
    return Capture({
      state,
      onIn: () => void store.captureIn(),
      onOut: () => void store.captureOutAndSave(),
      onNudgeDraft: (deltaSeconds) => void store.nudgeDraft(deltaSeconds),
      onTargetSequence: (sequenceId) => void store.selectCaptureTarget(sequenceId),
      onBeginSegmentEdit: (segmentId) => store.beginSegmentEdit(segmentId),
      onCancelSegmentEdit: () => store.cancelSegmentEdit(),
      onNudgeSegment: (segmentId, edge, deltaSeconds) => void store.nudgeSegmentTime(segmentId, edge, deltaSeconds),
      onDeleteSegment: (segmentId) => void store.deleteSegmentFromSelected(segmentId),
      onBeginRenameMixtape: (sequenceId) => void store.beginRenameMixtape(sequenceId),
      onCancelRenameMixtape: () => store.cancelRenameMixtape(),
      onRenameMixtape: (sequenceId, name) => void store.renameMixtape(sequenceId, name),
      onDeleteMixtape: (sequenceId) => {
        const sequence = state.store?.sequences.find((item) => item.id === sequenceId);
        const name = sequence?.name ?? '믹스테이프';
        const clipCount = sequence?.segments.length ?? 0;
        if (window.confirm(`"${name}" 믹스테이프를 삭제할까요? 저장된 구간 ${clipCount}개도 함께 삭제됩니다.`)) {
          void store.deleteMixtape(sequenceId);
        }
      },
    });
  }

  if (state.route === 'playback') {
    return Playback({
      state,
      onBack: () => store.setRoute('home'),
      onPlay: (index, sequenceId, mode) => void store.startSequence(index, sequenceId, mode),
      onStop: () => void store.stopPlayback(),
      onNext: () => void store.nextClip(),
      onEditSequence: (sequenceId) => void store.editMixtape(sequenceId),
      onRenameSequence: (sequenceId) => void store.beginRenameMixtape(sequenceId),
      onCancelQueueEdit: () => store.cancelQueueEdit(),
      onSaveQueueEdit: () => void store.saveQueueEdit(),
      onMoveQueueSegment: (fromIndex, toIndex) => store.moveQueueEditSegment(fromIndex, toIndex),
      onRemoveQueueSegment: (segmentId) => store.removeQueueEditSegment(segmentId),
    });
  }

  if (state.route === 'settings') {
    return Settings({
      state,
      onAccent: (key) => void store.setAccentKey(key),
      onSettingChange: (patch) => void store.updateSettings(patch),
    });
  }

  if (state.route === 'detail') {
    return Detail();
  }

  return Home({
    state,
    onCreate: () => void store.createMixtape(),
    onOpenSequence: (sequenceId) => void store.openMixtape(sequenceId),
    onPlaySequence: (sequenceId) => void store.startSequence(0, sequenceId),
  });
}

export function App(state: AppState, store: SnackTapeAppStore): HTMLElement {
  return el(
    'div',
    { className: 'app-shell' },
    PanelFrame({
      active: state.route,
      onRoute: (route) => store.setRoute(route),
      children: screenFor(state, store),
    })
  );
}
