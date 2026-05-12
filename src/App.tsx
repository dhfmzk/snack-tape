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

function offerJsonBackupBeforeDelete(store: SnackTapeAppStore, i18n: I18n, clipCount: number): void {
  if (clipCount <= 0) {
    return;
  }

  if (window.confirm(i18n.app.backupBeforeDeleteConfirm(clipCount))) {
    void store.exportData('json');
  }
}

function confirmDeleteMixtape(state: AppState, store: SnackTapeAppStore, i18n: I18n, sequenceId: string): void {
  const sequence = state.store?.sequences.find((item) => item.id === sequenceId);
  const name = sequence?.name ?? i18n.common.unnamedMixtape;
  const clipCount = sequence?.segments.length ?? 0;
  offerJsonBackupBeforeDelete(store, i18n, clipCount);
  if (window.confirm(i18n.app.deleteMixtapeConfirm(name, clipCount))) {
    void store.deleteMixtape(sequenceId);
  }
}

function confirmDeleteSegment(state: AppState, store: SnackTapeAppStore, i18n: I18n, segmentId: string): void {
  const sequence = state.store?.sequences.find((item) => item.id === state.store?.selectedSequenceId) ?? state.store?.sequences[0];
  const segment = sequence?.segments.find((item) => item.id === segmentId);
  const title = segment?.title ?? i18n.capture.segmentEdit;
  if (window.confirm(i18n.app.deleteSegmentConfirm(title))) {
    void store.deleteSegmentFromSelected(segmentId);
  }
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
      onOut: () => void store.captureOutPreview(),
      onSaveDraft: () => void store.saveCaptureDraft(),
      onClearDraft: () => void store.clearCaptureDraft(),
      onNudgeDraft: (deltaSeconds) => void store.nudgeDraft(deltaSeconds),
      onTargetSequence: (sequenceId) => void store.selectCaptureTarget(sequenceId),
      onBeginSegmentEdit: (segmentId) => store.beginSegmentEdit(segmentId),
      onCancelSegmentEdit: () => store.cancelSegmentEdit(),
      onNudgeSegment: (segmentId, edge, deltaSeconds) => void store.nudgeSegmentTime(segmentId, edge, deltaSeconds),
      onSetSegmentTimecode: (segmentId, edge, timecode) => void store.setSegmentTimecode(segmentId, edge, timecode),
      onSetSegmentNote: (segmentId, note) => void store.setSegmentNote(segmentId, note),
      onDeleteSegment: (segmentId) => confirmDeleteSegment(state, store, i18n, segmentId),
      onCopySegmentToMixtape: (segmentId, targetSequenceId) => void store.copySegmentToMixtape(segmentId, targetSequenceId),
      onMoveSegmentToMixtape: (segmentId, targetSequenceId) => void store.moveSegmentToMixtape(segmentId, targetSequenceId),
      onBeginRenameMixtape: (sequenceId) => void store.beginRenameMixtape(sequenceId),
      onCancelRenameMixtape: () => store.cancelRenameMixtape(),
      onRenameMixtape: (sequenceId, name) => void store.renameMixtape(sequenceId, name),
      onCreateMixtape: () => void store.createMixtape(),
      onRefreshVideo: () => void store.refreshVideo(),
      onDeleteMixtape: (sequenceId) => confirmDeleteMixtape(state, store, i18n, sequenceId),
    });
  }

  if (state.route === 'playback') {
    return Playback({
      state,
      i18n,
      onBack: () => store.setRoute('home'),
      onPlay: (index, sequenceId, mode) => void store.startSequence(index, sequenceId, mode),
      onPlayQueueFrom: (sequenceId, segmentId, queueSegmentIds) => void store.startQueueFrom(sequenceId, segmentId, queueSegmentIds),
      onPause: () => void store.pausePlayback(),
      onResume: () => void store.resumePlayback(),
      onStop: () => void store.stopPlayback(),
      onNext: () => void store.nextClip(),
      onSeek: (seconds) => void store.seekPlayback(seconds),
      onRetryPlayback: () => void store.retryPlaybackRecovery(),
      onEditSequence: (sequenceId) => void store.editMixtape(sequenceId),
      onEditSegment: (sequenceId, segmentId) => void store.editPlaybackSegment(sequenceId, segmentId),
      onRenameSequence: (sequenceId) => void store.beginRenameMixtape(sequenceId),
      onBeginQueueEdit: (sequenceId) => store.beginQueueEdit(sequenceId),
      onCancelQueueEdit: () => store.cancelQueueEdit(),
      onSaveQueueEdit: () => void store.saveQueueEdit(),
      onMoveQueueSegment: (fromIndex, toIndex) => store.moveQueueEditSegment(fromIndex, toIndex),
      onRemoveQueueSegment: (segmentId) => store.removeQueueEditSegment(segmentId),
      onRemovePlaybackQueueSegment: (segmentId) => void store.removePlaybackQueueSegment(segmentId),
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
      onReplaceImport: () => void store.replaceWithPendingImport(),
      onMergeImport: () => void store.mergePendingImport(),
      onCancelImport: () => store.cancelImportPreview(),
      onResetSettings: () => {
        if (window.confirm(i18n.settings.resetSettingsConfirm)) {
          void store.resetSettings();
        }
      },
      onDiagnostics: () => void store.copyDiagnostics(),
      onDeleteAll: () => {
        const clipCount = state.store?.sequences.reduce((total, sequence) => total + sequence.segments.length, 0) ?? 0;
        offerJsonBackupBeforeDelete(store, i18n, clipCount);
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
    onEditSequence: (sequenceId) => void store.editMixtape(sequenceId),
    onRenameSequence: (sequenceId) => void store.beginRenameMixtape(sequenceId),
    onDuplicateSequence: (sequenceId) => void store.duplicateMixtape(sequenceId),
    onDeleteSequence: (sequenceId) => confirmDeleteMixtape(state, store, i18n, sequenceId),
    onMergeSequence: (sourceSequenceId, targetSequenceId) => {
      const source = state.store?.sequences.find((item) => item.id === sourceSequenceId);
      const target = state.store?.sequences.find((item) => item.id === targetSequenceId);
      if (!source || !target) {
        return;
      }
      offerJsonBackupBeforeDelete(store, i18n, source.segments.length);
      if (window.confirm(i18n.app.mergeMixtapeConfirm(source.name, target.name, source.segments.length))) {
        void store.mergeMixtapeInto(sourceSequenceId, targetSequenceId);
      }
    },
    onHomeSearch: (query) => store.setHomeSearch(query),
    onHomeSort: (sort) => store.setHomeSort(sort),
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
