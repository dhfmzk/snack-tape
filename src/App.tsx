import { PanelFrame } from './components/PanelFrame.js';
import { el } from './components/dom.js';
import { createI18n, type I18n } from './i18n.js';
import { Capture } from './screens/Capture.js';
import { Detail } from './screens/Detail.js';
import { Home } from './screens/Home.js';
import { Playback } from './screens/Playback.js';
import { Settings } from './screens/Settings.js';
import type { AppState, SnackTapeAppStore } from './state/store.js';

function requestImportFile(onFile: (file: File) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) {
      onFile(file);
    }
  });
  input.click();
}

function screenFor(state: AppState, store: SnackTapeAppStore, i18n: I18n): HTMLElement {
  if (state.loading) {
    return el('div', { className: 'screen', dataset: { scrollKey: 'loading-screen' } }, el('p', { className: 'soft-empty', text: i18n.app.loading }));
  }

  if (state.route === 'capture') {
    return Capture({
      state,
      i18n,
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
        const name = sequence?.name ?? i18n.common.unnamedMixtape;
        const clipCount = sequence?.segments.length ?? 0;
        if (window.confirm(i18n.app.deleteMixtapeConfirm(name, clipCount))) {
          void store.deleteMixtape(sequenceId);
        }
      },
    });
  }

  if (state.route === 'playback') {
    return Playback({
      state,
      i18n,
      onBack: () => store.setRoute('home'),
      onPlay: (index, sequenceId, mode) => void store.startSequence(index, sequenceId, mode),
      onStop: () => void store.stopPlayback(),
      onNext: () => void store.nextClip(),
      onEditSequence: (sequenceId) => void store.editMixtape(sequenceId),
      onRenameSequence: (sequenceId) => void store.beginRenameMixtape(sequenceId),
      onBeginQueueEdit: (sequenceId) => store.beginQueueEdit(sequenceId),
      onCancelQueueEdit: () => store.cancelQueueEdit(),
      onSaveQueueEdit: () => void store.saveQueueEdit(),
      onMoveQueueSegment: (fromIndex, toIndex) => store.moveQueueEditSegment(fromIndex, toIndex),
      onRemoveQueueSegment: (segmentId) => store.removeQueueEditSegment(segmentId),
    });
  }

  if (state.route === 'settings') {
    return Settings({
      state,
      i18n,
      onAccent: (key) => void store.setAccentKey(key),
      onSettingChange: (patch) => void store.updateSettings(patch),
      onDefaultSaveTarget: (sequenceId) => void store.setDefaultMixtape(sequenceId),
      onExport: (format) => void store.exportData(format),
      onImport: () => requestImportFile((file) => void store.importDataFile(file)),
      onDeleteAll: () => {
        const clipCount = state.store?.sequences.reduce((total, sequence) => total + sequence.segments.length, 0) ?? 0;
        if (window.confirm(i18n.settings.deleteAllClipsConfirm(clipCount))) {
          void store.deleteAllData();
        }
      },
    });
  }

  if (state.route === 'detail') {
    return Detail(i18n);
  }

  return Home({
    state,
    i18n,
    onCreate: () => void store.createMixtape(),
    onOpenSequence: (sequenceId) => void store.openMixtape(sequenceId),
    onPlaySequence: (sequenceId) => void store.startSequence(0, sequenceId),
  });
}

export function App(state: AppState, store: SnackTapeAppStore): HTMLElement {
  const i18n = createI18n(state.settings.language);

  return el(
    'div',
    { className: 'app-shell' },
    PanelFrame({
      active: state.route,
      i18n,
      onRoute: (route) => store.setRoute(route),
      children: screenFor(state, store, i18n),
    })
  );
}
