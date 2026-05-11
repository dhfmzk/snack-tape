export const LANGUAGES = ['ko', 'en', 'ja'] as const;

export type Language = (typeof LANGUAGES)[number];

export type I18n = {
  language: Language;
  app: {
    loading: string;
    backupBeforeDeleteConfirm: (clipCount: number) => string;
    deleteMixtapeConfirm: (name: string, clipCount: number) => string;
    deleteSegmentConfirm: (title: string) => string;
    mergeMixtapeConfirm: (sourceName: string, targetName: string, clipCount: number) => string;
  };
  common: {
    noMixtape: string;
    unnamedMixtape: string;
    readingTitle: string;
    openYoutubeVideo: string;
    copyName: (name: string) => string;
    saveFailed: (message: string) => string;
    end: string;
  };
  tabs: {
    aria: string;
    capture: string;
    home: string;
    settings: string;
  };
  home: {
    title: string;
    newTape: string;
    newTapeAria: string;
    emptyTitle: string;
    search: string;
    sort: string;
    sortManual: string;
    sortUpdated: string;
    sortName: string;
    sortClipCount: string;
    menu: (name: string) => string;
    editAction: string;
    renameAction: string;
    duplicateAction: string;
    deleteAction: string;
    mergeAction: string;
    edit: (name: string) => string;
    rename: (name: string) => string;
    duplicate: (name: string) => string;
    delete: (name: string) => string;
    mergeTarget: (name: string) => string;
    merge: (name: string) => string;
    playAria: (name: string) => string;
    clipCount: (count: number) => string;
  };
  capture: {
    saveLocation: string;
    saveLocationSelect: string;
    renameSelectedTape: string;
    deleteSelectedTape: string;
    mixtapeName: string;
    saveMixtapeName: string;
    cancelMixtapeName: string;
    segmentMenu: (title: string) => string;
    editSegment: string;
    editSegmentAria: (title: string) => string;
    deleteSegment: string;
    deleteSegmentAria: (title: string) => string;
    segmentTransferTarget: (title: string) => string;
    copySegment: string;
    copySegmentAria: (title: string) => string;
    moveSegment: string;
    moveSegmentAria: (title: string) => string;
    segmentEditDone: (title: string) => string;
    segmentTimeInput: (title: string, label: string) => string;
    segmentEdit: string;
    done: string;
    start: string;
    end: string;
    captureInAria: string;
    captureOutAria: string;
    captureOutPreviewAria: string;
    inButton: string;
    outButton: string;
    mark: string;
    now: string;
    inFirst: string;
    adjustInMarker: string;
    adjustOutMarker: string;
    adjust: (label: string) => string;
    clearDraft: string;
    clearDraftAria: string;
    saveDraftClip: string;
    saveDraftClipAria: string;
    sessionSaved: (count: number) => string;
    currentlyCapturing: string;
    noticeOpenYoutubeVideo: string;
    noticeNoSaveTarget: string;
    noticeInFirst: string;
    noticeTimeUnavailable: string;
    noticeVideoRefreshFailed: (message: string) => string;
    noticeInvalidSegment: string;
    noticeInvalidTimecode: string;
    noticeInvalidRange: string;
    createSaveTarget: string;
    refreshVideoTime: string;
    videoStatusReady: string;
    videoStatusOpenYoutube: string;
    videoStatusNotYoutube: string;
    videoStatusTimeUnavailable: string;
  };
  playback: {
    emptyTitle: string;
    emptyCopy: string;
    backToMixtapes: string;
    renameMixtape: string;
    nowPlaying: string;
    ready: string;
    starting: string;
    waiting: string;
    paused: string;
    targetTab: (tabId: number | undefined) => string;
    connected: string;
    disconnected: string;
    progress: string;
    shuffle: string;
    previous: string;
    stop: string;
    pause: string;
    resume: string;
    play: string;
    next: string;
    repeatCurrent: string;
    queue: string;
    editing: string;
    edit: string;
    editMixtape: string;
    editQueue: string;
    editSegment: (title: string) => string;
    upNextCount: (count: number) => string;
    moveUp: (title: string) => string;
    moveDown: (title: string) => string;
    removeFromQueue: (title: string) => string;
    playSegment: (title: string) => string;
    playFromHere: (title: string) => string;
    repeatSegment: (title: string) => string;
    cancelQueueEdit: string;
    saveQueueEdit: string;
    cancel: string;
    done: string;
    reconnect: string;
    reconnectAria: string;
    sequenceMode: string;
    repeatMode: string;
    recoveryStartSummary: (tapeName: string, mode: string, queue: string) => string;
    recoveryEditedQueue: (count: number) => string;
    recoverySessionQueue: (count: number) => string;
    recoveryShuffleQueue: string;
    recoverySavedQueue: string;
    recoveryNextSummary: string;
    recoveryStopSummary: string;
    stopRecoveryAria: string;
    connectionLost: string;
    noPlaybackTab: string;
    currentSegmentMissing: string;
    contentRequestFailed: string;
    runtimeUnavailable: string;
    unsupportedRequest: string;
    unknownError: string;
    startFailed: (message: string) => string;
    nextFailed: (message: string) => string;
    seekFailed: (message: string) => string;
    pauseFailed: (message: string) => string;
    resumeFailed: (message: string) => string;
    stopFailed: (message: string) => string;
  };
  settings: {
    title: string;
    language: string;
    languageHelp: string;
    languageCode: string;
    Korean: string;
    English: string;
    Japanese: string;
    accentColor: string;
    accentHelp: string;
    selectPalette: (name: string) => string;
    turnOn: string;
    turnOff: string;
    playback: string;
    autoNext: string;
    autoNextHelp: string;
    fadeOut: string;
    fadeOutHelp: string;
    shuffleByDefault: string;
    capture: string;
    shortcutIn: string;
    shortcutOut: string;
    shortcutHelp: string;
    defaultSaveLocation: string;
    defaultSaveLocationSelect: string;
    autoTitle: string;
    autoTitleHelp: string;
    data: string;
    export: string;
    exportJson: string;
    exportCsv: string;
    import: string;
    importHelp: string;
    deleteAllClips: string;
    deleteAllClipsHelp: string;
    deleteAllClipsConfirm: (clipCount: number) => string;
    exportReady: (format: string) => string;
    importReady: (mixtapeCount: number) => string;
    importFailed: string;
    deleteAllDone: string;
  };
  detail: {
    title: string;
    copy: string;
  };
  content: {
    continuePrompt: string;
    continueButton: string;
    retryPrompt: string;
    retryButton: string;
  };
};

const TRANSLATIONS: Record<Language, Omit<I18n, 'language'>> = {
  ko: {
    app: {
      loading: '불러오는 중...',
      backupBeforeDeleteConfirm: (clipCount) => `삭제 전에 JSON 백업을 먼저 받을까요? 저장된 클립 ${clipCount}개가 포함됩니다.`,
      deleteMixtapeConfirm: (name, clipCount) => `"${name}" 믹스테이프를 삭제할까요? 저장된 구간 ${clipCount}개도 함께 삭제됩니다.`,
      deleteSegmentConfirm: (title) => `"${title}" 구간을 삭제할까요?`,
      mergeMixtapeConfirm: (sourceName, targetName, clipCount) => `"${sourceName}"의 구간 ${clipCount}개를 "${targetName}"에 병합할까요? 원본 테이프는 삭제됩니다.`,
    },
    common: {
      noMixtape: '믹스테이프 없음',
      unnamedMixtape: '믹스테이프',
      readingTitle: '제목을 읽는 중',
      openYoutubeVideo: 'YouTube 영상에서 열어주세요',
      copyName: (name) => `${name} 복사본`,
      saveFailed: (message) => `저장하지 못했습니다.${message ? ` ${message}` : ''}`,
      end: 'END',
    },
    tabs: {
      aria: 'SnackTape 화면',
      capture: '편집',
      home: '믹스테이프',
      settings: '설정',
    },
    home: {
      title: '내 믹스테이프',
      newTape: '새 테이프',
      newTapeAria: '새 테이프 만들기',
      emptyTitle: '첫 믹스테이프를 만들어보세요',
      search: '믹스테이프 검색',
      sort: '믹스테이프 정렬',
      sortManual: '직접 순서',
      sortUpdated: '최근 수정',
      sortName: '이름',
      sortClipCount: '클립 수',
      menu: (name) => `${name} 메뉴`,
      editAction: '편집',
      renameAction: '이름 변경',
      duplicateAction: '복제',
      deleteAction: '삭제',
      mergeAction: '병합',
      edit: (name) => `${name} 편집`,
      rename: (name) => `${name} 이름 변경`,
      duplicate: (name) => `${name} 복제`,
      delete: (name) => `${name} 삭제`,
      mergeTarget: (name) => `${name} 병합 대상`,
      merge: (name) => `${name} 병합`,
      playAria: (name) => `${name} 재생`,
      clipCount: (count) => `${count} CLIPS`,
    },
    capture: {
      saveLocation: '저장 위치',
      saveLocationSelect: '저장 위치 선택',
      renameSelectedTape: '선택된 테이프 이름 변경',
      deleteSelectedTape: '선택된 테이프 삭제',
      mixtapeName: '믹스테이프 이름',
      saveMixtapeName: '믹스테이프 이름 저장',
      cancelMixtapeName: '믹스테이프 이름 변경 취소',
      segmentMenu: (title) => `${title} 메뉴`,
      editSegment: '구간 편집',
      editSegmentAria: (title) => `${title} 구간 편집`,
      deleteSegment: '삭제',
      deleteSegmentAria: (title) => `${title} 삭제`,
      segmentTransferTarget: (title) => `${title} 이동/복사 대상`,
      copySegment: '복사',
      copySegmentAria: (title) => `${title} 복사`,
      moveSegment: '이동',
      moveSegmentAria: (title) => `${title} 이동`,
      segmentEditDone: (title) => `${title} 편집 완료`,
      segmentTimeInput: (title, label) => `${title} ${label} 시간`,
      segmentEdit: '구간 편집',
      done: '완료',
      start: '시작',
      end: '끝',
      captureInAria: 'IN 마커 찍기',
      captureOutAria: 'OUT 마커 찍고 추가',
      captureOutPreviewAria: 'OUT 마커 미리보기',
      inButton: 'IN · I',
      outButton: 'OUT + 추가 · O',
      mark: '찍기',
      now: '지금',
      inFirst: 'IN 먼저',
      adjustInMarker: 'IN 조정',
      adjustOutMarker: 'OUT 조정',
      adjust: (label) => `${label} 조정`,
      clearDraft: '취소',
      clearDraftAria: '캡처 드래프트 취소',
      saveDraftClip: '저장',
      saveDraftClipAria: '현재 구간 저장',
      sessionSaved: (count) => `이번 세션 · ${count}개 저장됨`,
      currentlyCapturing: '현재 캡처 중',
      noticeOpenYoutubeVideo: 'YouTube 영상에서 열어주세요.',
      noticeNoSaveTarget: '저장할 믹스테이프를 선택하세요.',
      noticeInFirst: 'IN 먼저 찍어주세요.',
      noticeTimeUnavailable: '영상 시간을 읽을 수 없습니다. 새로고침 후 다시 시도해주세요.',
      noticeVideoRefreshFailed: (message) => `영상 정보를 갱신할 수 없습니다. ${message}`,
      noticeInvalidSegment: '구간을 저장할 수 없습니다.',
      noticeInvalidTimecode: '시간은 초, 00:00.00, 1:00:00.00 형식으로 입력해주세요.',
      noticeInvalidRange: '시작 시간과 끝 시간 사이에는 최소 1프레임 간격이 필요합니다.',
      createSaveTarget: '새 테이프 만들기',
      refreshVideoTime: '영상 시간 새로고침',
      videoStatusReady: '캡처 준비됨',
      videoStatusOpenYoutube: 'YouTube 영상을 열어주세요.',
      videoStatusNotYoutube: '현재 탭은 YouTube 영상이 아닙니다.',
      videoStatusTimeUnavailable: '영상 시간을 읽을 수 없습니다.',
    },
    playback: {
      emptyTitle: '재생할 클립이 없습니다',
      emptyCopy: '편집 탭에서 첫 구간을 저장하면 큐가 만들어집니다.',
      backToMixtapes: '믹스테이프로 돌아가기',
      renameMixtape: '믹스테이프 이름 변경',
      nowPlaying: 'NOW PLAYING',
      ready: 'READY',
      starting: 'STARTING',
      waiting: 'WAITING',
      paused: 'PAUSED',
      targetTab: (tabId) => `TAB ${tabId ?? '-'}`,
      connected: 'CONNECTED',
      disconnected: 'SYNCING',
      progress: '재생 진행률',
      shuffle: '셔플 재생',
      previous: '이전 클립',
      stop: '정지',
      pause: '일시정지',
      resume: '재개',
      play: '재생',
      next: '다음 클립',
      repeatCurrent: '현재 클립 다시 재생',
      queue: 'QUEUE',
      editing: '편집 중',
      edit: '편집',
      editMixtape: '믹스테이프 편집',
      editQueue: '큐 편집',
      editSegment: (title) => `${title} 구간 편집`,
      upNextCount: (count) => `${count} UP NEXT`,
      moveUp: (title) => `${title} 위로 이동`,
      moveDown: (title) => `${title} 아래로 이동`,
      removeFromQueue: (title) => `${title} 큐에서 제거`,
      playSegment: (title) => `${title} 재생`,
      playFromHere: (title) => `${title}부터 순서대로 재생`,
      repeatSegment: (title) => `${title}만 반복 재생`,
      cancelQueueEdit: '큐 편집 취소',
      saveQueueEdit: '큐 편집 완료',
      cancel: '취소',
      done: '완료',
      reconnect: '다시 연결',
      reconnectAria: '재생 다시 연결',
      sequenceMode: '순서 재생',
      repeatMode: '반복 재생',
      recoveryStartSummary: (tapeName, mode, queue) => `${tapeName} · ${mode} · ${queue}`,
      recoveryEditedQueue: (count) => `편집된 큐 ${count}개 유지`,
      recoverySessionQueue: (count) => `세션 순서 ${count}개 유지`,
      recoveryShuffleQueue: '새 셔플 순서',
      recoverySavedQueue: '저장된 목록 순서',
      recoveryNextSummary: '현재 재생 세션에서 다음 클립으로 다시 시도합니다.',
      recoveryStopSummary: '현재 재생 세션을 정지 상태로 정리합니다.',
      stopRecoveryAria: '재생 정지',
      connectionLost: 'YouTube 탭과 연결할 수 없습니다. 다시 연결하거나 재생을 정지해주세요.',
      noPlaybackTab: '재생 중인 YouTube 탭을 찾을 수 없습니다.',
      currentSegmentMissing: '재생 중인 구간을 찾을 수 없습니다.',
      contentRequestFailed: 'YouTube 페이지와 연결할 수 없습니다. 새로고침 후 다시 시도해주세요.',
      runtimeUnavailable: '확장 프로그램 백그라운드와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.',
      unsupportedRequest: '지원하지 않는 재생 요청입니다.',
      unknownError: '알 수 없는 재생 오류가 발생했습니다.',
      startFailed: (message) => `재생을 시작할 수 없습니다. ${message}`,
      nextFailed: (message) => `다음 클립으로 이동할 수 없습니다. ${message}`,
      seekFailed: (message) => `재생 위치를 이동할 수 없습니다. ${message}`,
      pauseFailed: (message) => `재생을 일시정지할 수 없습니다. ${message}`,
      resumeFailed: (message) => `재생을 재개할 수 없습니다. ${message}`,
      stopFailed: (message) => `재생을 정지할 수 없습니다. ${message}`,
    },
    settings: {
      title: '설정',
      language: '언어',
      languageHelp: '앱 표시 언어입니다.',
      languageCode: 'KO',
      Korean: '한국어',
      English: 'English',
      Japanese: '日本語',
      accentColor: '포인트 컬러',
      accentHelp: '현재 재생 / 저장 / 활성 상태에 사용되는 색입니다.',
      selectPalette: (name) => `${name} 선택`,
      turnOn: '켜기',
      turnOff: '끄기',
      playback: '재생',
      autoNext: '자동 다음 재생',
      autoNextHelp: '구간 끝나면 다음 클립으로',
      fadeOut: '구간 끝에서 0.3초 페이드',
      fadeOutHelp: '끊김 부드럽게',
      shuffleByDefault: '기본 시작 시 셔플',
      capture: '캡처',
      shortcutIn: '단축키 — IN',
      shortcutOut: '단축키 — OUT + 저장',
      shortcutHelp: 'Chrome 확장 프로그램 단축키에서 변경할 수 있습니다.',
      defaultSaveLocation: '기본 저장 위치',
      defaultSaveLocationSelect: '기본 저장 위치 선택',
      autoTitle: 'OUT 시 자동 제목 추론',
      autoTitleHelp: '자막·챕터에서 추출',
      data: '데이터',
      export: '내보내기',
      exportJson: 'JSON',
      exportCsv: 'CSV',
      import: '가져오기',
      importHelp: 'JSON 백업 파일로 교체',
      deleteAllClips: '모든 클립 삭제',
      deleteAllClipsHelp: '믹스테이프와 저장된 구간을 비웁니다.',
      deleteAllClipsConfirm: (clipCount) => `저장된 클립 ${clipCount}개와 모든 믹스테이프를 삭제할까요?`,
      exportReady: (format) => `${format.toUpperCase()} 내보내기를 준비했습니다.`,
      importReady: (mixtapeCount) => `${mixtapeCount}개 믹스테이프를 가져왔습니다.`,
      importFailed: '가져올 수 없는 JSON 파일입니다.',
      deleteAllDone: '모든 클립을 삭제했습니다.',
    },
    detail: {
      title: '상세 편집은 M2 범위입니다',
      copy: '클립 제목, 메모, 태그, 미세 조정은 다음 단계에서 붙입니다.',
    },
    content: {
      continuePrompt: 'SnackTape 재생을 계속할까요?',
      continueButton: '계속 재생',
      retryPrompt: 'YouTube 플레이어를 직접 한 번 클릭한 뒤 다시 시도해주세요.',
      retryButton: '다시 시도',
    },
  },
  ja: {
    app: {
      loading: '読み込み中...',
      backupBeforeDeleteConfirm: (clipCount) => `削除前にJSONバックアップを書き出しますか？保存済みクリップ${clipCount}件が含まれます。`,
      deleteMixtapeConfirm: (name, clipCount) => `「${name}」を削除しますか？保存済みクリップ${clipCount}件も削除されます。`,
      deleteSegmentConfirm: (title) => `「${title}」の範囲を削除しますか？`,
      mergeMixtapeConfirm: (sourceName, targetName, clipCount) => `「${sourceName}」のクリップ${clipCount}件を「${targetName}」に結合しますか？元のテープは削除されます。`,
    },
    common: {
      noMixtape: 'ミックステープなし',
      unnamedMixtape: 'ミックステープ',
      readingTitle: 'タイトルを読み込み中',
      openYoutubeVideo: 'YouTube動画を開いてください',
      copyName: (name) => `${name} コピー`,
      saveFailed: (message) => `保存できませんでした。${message ? ` ${message}` : ''}`,
      end: 'END',
    },
    tabs: {
      aria: 'SnackTape 画面',
      capture: '編集',
      home: 'ミックステープ',
      settings: '設定',
    },
    home: {
      title: 'マイミックステープ',
      newTape: '新規テープ',
      newTapeAria: '新規テープを作成',
      emptyTitle: '最初のミックステープを作成しましょう',
      search: 'ミックステープを検索',
      sort: 'ミックステープを並べ替え',
      sortManual: '手動順',
      sortUpdated: '最近更新',
      sortName: '名前',
      sortClipCount: 'クリップ数',
      menu: (name) => `${name} メニュー`,
      editAction: '編集',
      renameAction: '名前を変更',
      duplicateAction: '複製',
      deleteAction: '削除',
      mergeAction: '結合',
      edit: (name) => `${name}を編集`,
      rename: (name) => `${name}の名前を変更`,
      duplicate: (name) => `${name}を複製`,
      delete: (name) => `${name}を削除`,
      mergeTarget: (name) => `${name}の結合先`,
      merge: (name) => `${name}を結合`,
      playAria: (name) => `${name}を再生`,
      clipCount: (count) => `${count} CLIPS`,
    },
    capture: {
      saveLocation: '保存先',
      saveLocationSelect: '保存先を選択',
      renameSelectedTape: '選択中のテープ名を変更',
      deleteSelectedTape: '選択中のテープを削除',
      mixtapeName: 'ミックステープ名',
      saveMixtapeName: 'ミックステープ名を保存',
      cancelMixtapeName: 'ミックステープ名の変更をキャンセル',
      segmentMenu: (title) => `${title} メニュー`,
      editSegment: '範囲を編集',
      editSegmentAria: (title) => `${title}の範囲を編集`,
      deleteSegment: '削除',
      deleteSegmentAria: (title) => `${title}を削除`,
      segmentTransferTarget: (title) => `${title}の移動/コピー先`,
      copySegment: 'コピー',
      copySegmentAria: (title) => `${title}をコピー`,
      moveSegment: '移動',
      moveSegmentAria: (title) => `${title}を移動`,
      segmentEditDone: (title) => `${title}の編集を完了`,
      segmentTimeInput: (title, label) => `${title}の${label}時間`,
      segmentEdit: '範囲を編集',
      done: '完了',
      start: '開始',
      end: '終了',
      captureInAria: 'INマーカーを設定',
      captureOutAria: 'OUTマーカーを設定して追加',
      captureOutPreviewAria: 'OUTマーカーをプレビュー',
      inButton: 'IN · I',
      outButton: 'OUT + 追加 · O',
      mark: 'マーク',
      now: '今',
      inFirst: '先にIN',
      adjustInMarker: 'INを調整',
      adjustOutMarker: 'OUTを調整',
      adjust: (label) => `${label}を調整`,
      clearDraft: '取消',
      clearDraftAria: 'キャプチャ下書きを取り消す',
      saveDraftClip: '保存',
      saveDraftClipAria: '現在の範囲を保存',
      sessionSaved: (count) => `このセッション · ${count}件保存済み`,
      currentlyCapturing: '現在キャプチャ中',
      noticeOpenYoutubeVideo: '先にYouTube動画を開いてください。',
      noticeNoSaveTarget: '保存先のミックステープを選択してください。',
      noticeInFirst: '先にINを設定してください。',
      noticeTimeUnavailable: '動画の時間を読み取れません。YouTubeを更新して再試行してください。',
      noticeVideoRefreshFailed: (message) => `動画情報を更新できません。 ${message}`,
      noticeInvalidSegment: 'この範囲は保存できません。',
      noticeInvalidTimecode: '時間は秒、00:00.00、1:00:00.00形式で入力してください。',
      noticeInvalidRange: '開始時間と終了時間の間には最低1フレームの間隔が必要です。',
      createSaveTarget: '新規テープを作成',
      refreshVideoTime: '動画時間を更新',
      videoStatusReady: 'キャプチャ準備完了',
      videoStatusOpenYoutube: 'YouTube動画を開いてください。',
      videoStatusNotYoutube: '現在のタブはYouTube動画ではありません。',
      videoStatusTimeUnavailable: '動画の時間を読み取れません。',
    },
    playback: {
      emptyTitle: '再生するクリップがありません',
      emptyCopy: '編集タブで最初の範囲を保存するとキューが作成されます。',
      backToMixtapes: 'ミックステープに戻る',
      renameMixtape: 'ミックステープ名を変更',
      nowPlaying: 'NOW PLAYING',
      ready: 'READY',
      starting: 'STARTING',
      waiting: 'WAITING',
      paused: 'PAUSED',
      targetTab: (tabId) => `TAB ${tabId ?? '-'}`,
      connected: 'CONNECTED',
      disconnected: 'SYNCING',
      progress: '再生の進行状況',
      shuffle: 'シャッフル再生',
      previous: '前のクリップ',
      stop: '停止',
      pause: '一時停止',
      resume: '再開',
      play: '再生',
      next: '次のクリップ',
      repeatCurrent: '現在のクリップをもう一度再生',
      queue: 'QUEUE',
      editing: '編集中',
      edit: '編集',
      editMixtape: 'ミックステープを編集',
      editQueue: 'キューを編集',
      editSegment: (title) => `${title}の範囲を編集`,
      upNextCount: (count) => `${count} UP NEXT`,
      moveUp: (title) => `${title}を上へ移動`,
      moveDown: (title) => `${title}を下へ移動`,
      removeFromQueue: (title) => `${title}をキューから削除`,
      playSegment: (title) => `${title}を再生`,
      playFromHere: (title) => `${title}から順番に再生`,
      repeatSegment: (title) => `${title}だけをリピート再生`,
      cancelQueueEdit: 'キュー編集をキャンセル',
      saveQueueEdit: 'キュー編集を完了',
      cancel: 'キャンセル',
      done: '完了',
      reconnect: '再接続',
      reconnectAria: '再生を再接続',
      sequenceMode: '順番再生',
      repeatMode: 'リピート再生',
      recoveryStartSummary: (tapeName, mode, queue) => `${tapeName} · ${mode} · ${queue}`,
      recoveryEditedQueue: (count) => `編集済みキュー${count}件を保持`,
      recoverySessionQueue: (count) => `セッション順${count}件を保持`,
      recoveryShuffleQueue: '新しいシャッフル順',
      recoverySavedQueue: '保存済みリスト順',
      recoveryNextSummary: '現在の再生セッションで次のクリップを再試行します。',
      recoveryStopSummary: '現在の再生セッションを停止状態に戻します。',
      stopRecoveryAria: '再生を停止',
      connectionLost: 'YouTubeタブに接続できません。再接続するか再生を停止してください。',
      noPlaybackTab: '再生中のYouTubeタブが見つかりません。',
      currentSegmentMissing: '再生中の範囲が見つかりません。',
      contentRequestFailed: 'YouTubeページに接続できません。再読み込みしてからもう一度お試しください。',
      runtimeUnavailable: '拡張機能のバックグラウンドに接続できません。しばらくしてからもう一度お試しください。',
      unsupportedRequest: '対応していない再生リクエストです。',
      unknownError: '不明な再生エラーが発生しました。',
      startFailed: (message) => `再生を開始できません。 ${message}`,
      nextFailed: (message) => `次のクリップへ移動できません。 ${message}`,
      seekFailed: (message) => `再生位置を移動できません。 ${message}`,
      pauseFailed: (message) => `再生を一時停止できません。 ${message}`,
      resumeFailed: (message) => `再生を再開できません。 ${message}`,
      stopFailed: (message) => `再生を停止できません。 ${message}`,
    },
    settings: {
      title: '設定',
      language: '言語',
      languageHelp: 'アプリの表示言語です。',
      languageCode: 'JA',
      Korean: '한국어',
      English: 'English',
      Japanese: '日本語',
      accentColor: 'アクセントカラー',
      accentHelp: '再生、保存、アクティブ状態に使われる色です。',
      selectPalette: (name) => `${name}を選択`,
      turnOn: 'オン',
      turnOff: 'オフ',
      playback: '再生',
      autoNext: '次を自動再生',
      autoNextHelp: '範囲が終わったら次のクリップへ',
      fadeOut: '範囲の終わりで0.3秒フェード',
      fadeOutHelp: '切り替わりをなめらかに',
      shuffleByDefault: '開始時は既定でシャッフル',
      capture: '編集',
      shortcutIn: 'ショートカット — IN',
      shortcutOut: 'ショートカット — OUT + 保存',
      shortcutHelp: 'Chrome拡張機能のショートカットで変更できます。',
      defaultSaveLocation: '既定の保存先',
      defaultSaveLocationSelect: '既定の保存先を選択',
      autoTitle: 'OUT時にタイトルを自動推定',
      autoTitleHelp: '字幕・チャプターから抽出',
      data: 'データ',
      export: 'エクスポート',
      exportJson: 'JSON',
      exportCsv: 'CSV',
      import: 'インポート',
      importHelp: 'JSONバックアップで置き換え',
      deleteAllClips: 'すべてのクリップを削除',
      deleteAllClipsHelp: 'ミックステープと保存済み範囲を空にします。',
      deleteAllClipsConfirm: (clipCount) => `保存済みクリップ${clipCount}件とすべてのミックステープを削除しますか？`,
      exportReady: (format) => `${format.toUpperCase()}のエクスポートを準備しました。`,
      importReady: (mixtapeCount) => `${mixtapeCount}件のミックステープをインポートしました。`,
      importFailed: 'インポートできないJSONファイルです。',
      deleteAllDone: 'すべてのクリップを削除しました。',
    },
    detail: {
      title: '詳細編集はM2で対応予定です',
      copy: 'クリップタイトル、メモ、タグ、微調整は次のマイルストーンで追加します。',
    },
    content: {
      continuePrompt: 'SnackTapeの再生を続けますか？',
      continueButton: '続けて再生',
      retryPrompt: 'YouTubeプレーヤーを一度クリックしてから再試行してください。',
      retryButton: '再試行',
    },
  },
  en: {
    app: {
      loading: 'Loading...',
      backupBeforeDeleteConfirm: (clipCount) => `Export a JSON backup before deleting? It will include ${clipCount} saved clip${clipCount === 1 ? '' : 's'}.`,
      deleteMixtapeConfirm: (name, clipCount) => `Delete "${name}"? ${clipCount} saved clip${clipCount === 1 ? '' : 's'} will be deleted too.`,
      deleteSegmentConfirm: (title) => `Delete the "${title}" range?`,
      mergeMixtapeConfirm: (sourceName, targetName, clipCount) => `Merge ${clipCount} clip${clipCount === 1 ? '' : 's'} from "${sourceName}" into "${targetName}"? The source tape will be deleted.`,
    },
    common: {
      noMixtape: 'No mixtape',
      unnamedMixtape: 'Mixtape',
      readingTitle: 'Reading title',
      openYoutubeVideo: 'Open a YouTube video',
      copyName: (name) => `${name} Copy`,
      saveFailed: (message) => `Could not save.${message ? ` ${message}` : ''}`,
      end: 'END',
    },
    tabs: {
      aria: 'SnackTape screens',
      capture: 'Edit',
      home: 'Mixtapes',
      settings: 'Settings',
    },
    home: {
      title: 'My Mixtapes',
      newTape: 'New Tape',
      newTapeAria: 'Create new tape',
      emptyTitle: 'Create your first mixtape',
      search: 'Search mixtapes',
      sort: 'Sort mixtapes',
      sortManual: 'Manual order',
      sortUpdated: 'Recently updated',
      sortName: 'Name',
      sortClipCount: 'Clip count',
      menu: (name) => `${name} menu`,
      editAction: 'Edit',
      renameAction: 'Rename',
      duplicateAction: 'Duplicate',
      deleteAction: 'Delete',
      mergeAction: 'Merge',
      edit: (name) => `Edit ${name}`,
      rename: (name) => `Rename ${name}`,
      duplicate: (name) => `Duplicate ${name}`,
      delete: (name) => `Delete ${name}`,
      mergeTarget: (name) => `Merge target for ${name}`,
      merge: (name) => `Merge ${name}`,
      playAria: (name) => `Play ${name}`,
      clipCount: (count) => `${count} ${count === 1 ? 'CLIP' : 'CLIPS'}`,
    },
    capture: {
      saveLocation: 'Save to',
      saveLocationSelect: 'Choose save location',
      renameSelectedTape: 'Rename selected tape',
      deleteSelectedTape: 'Delete selected tape',
      mixtapeName: 'Mixtape name',
      saveMixtapeName: 'Save mixtape name',
      cancelMixtapeName: 'Cancel mixtape rename',
      segmentMenu: (title) => `${title} menu`,
      editSegment: 'Edit range',
      editSegmentAria: (title) => `Edit range for ${title}`,
      deleteSegment: 'Delete',
      deleteSegmentAria: (title) => `Delete ${title}`,
      segmentTransferTarget: (title) => `Move/copy target for ${title}`,
      copySegment: 'Copy',
      copySegmentAria: (title) => `Copy ${title}`,
      moveSegment: 'Move',
      moveSegmentAria: (title) => `Move ${title}`,
      segmentEditDone: (title) => `Finish editing ${title}`,
      segmentTimeInput: (title, label) => `${title} ${label} time`,
      segmentEdit: 'Edit range',
      done: 'Done',
      start: 'Start',
      end: 'End',
      captureInAria: 'Mark IN',
      captureOutAria: 'Mark OUT and add',
      captureOutPreviewAria: 'Preview OUT marker',
      inButton: 'IN · I',
      outButton: 'OUT + Add · O',
      mark: 'Mark',
      now: 'Now',
      inFirst: 'IN first',
      adjustInMarker: 'Adjust IN',
      adjustOutMarker: 'Adjust OUT',
      adjust: (label) => `Adjust ${label}`,
      clearDraft: 'Clear',
      clearDraftAria: 'Clear capture draft',
      saveDraftClip: 'Save',
      saveDraftClipAria: 'Save current range',
      sessionSaved: (count) => `This session · ${count} saved`,
      currentlyCapturing: 'Capturing now',
      noticeOpenYoutubeVideo: 'Open a YouTube video first.',
      noticeNoSaveTarget: 'Choose a save mixtape.',
      noticeInFirst: 'Mark IN first.',
      noticeTimeUnavailable: 'Cannot read the video time. Refresh YouTube and try again.',
      noticeVideoRefreshFailed: (message) => `Cannot refresh video info. ${message}`,
      noticeInvalidSegment: 'Cannot save this range.',
      noticeInvalidTimecode: 'Enter time as seconds, 00:00.00, or 1:00:00.00.',
      noticeInvalidRange: 'Start and end must stay at least one frame apart.',
      createSaveTarget: 'Create new tape',
      refreshVideoTime: 'Refresh video time',
      videoStatusReady: 'Ready to capture',
      videoStatusOpenYoutube: 'Open a YouTube video.',
      videoStatusNotYoutube: 'The active tab is not a YouTube video.',
      videoStatusTimeUnavailable: 'Cannot read the video time.',
    },
    playback: {
      emptyTitle: 'No clips to play',
      emptyCopy: 'Save the first range in the Edit tab to build a queue.',
      backToMixtapes: 'Back to mixtapes',
      renameMixtape: 'Rename mixtape',
      nowPlaying: 'NOW PLAYING',
      ready: 'READY',
      starting: 'STARTING',
      waiting: 'WAITING',
      paused: 'PAUSED',
      targetTab: (tabId) => `TAB ${tabId ?? '-'}`,
      connected: 'CONNECTED',
      disconnected: 'SYNCING',
      progress: 'Playback progress',
      shuffle: 'Shuffle play',
      previous: 'Previous clip',
      stop: 'Stop',
      pause: 'Pause',
      resume: 'Resume',
      play: 'Play',
      next: 'Next clip',
      repeatCurrent: 'Replay current clip',
      queue: 'QUEUE',
      editing: 'Editing',
      edit: 'Edit',
      editMixtape: 'Edit mixtape',
      editQueue: 'Edit queue',
      editSegment: (title) => `Edit range for ${title}`,
      upNextCount: (count) => `${count} UP NEXT`,
      moveUp: (title) => `Move ${title} up`,
      moveDown: (title) => `Move ${title} down`,
      removeFromQueue: (title) => `Remove ${title} from queue`,
      playSegment: (title) => `Play ${title}`,
      playFromHere: (title) => `Play from ${title}`,
      repeatSegment: (title) => `Repeat ${title} only`,
      cancelQueueEdit: 'Cancel queue edit',
      saveQueueEdit: 'Save queue edit',
      cancel: 'Cancel',
      done: 'Done',
      reconnect: 'Reconnect',
      reconnectAria: 'Reconnect playback',
      sequenceMode: 'Sequence play',
      repeatMode: 'Repeat play',
      recoveryStartSummary: (tapeName, mode, queue) => `${tapeName} · ${mode} · ${queue}`,
      recoveryEditedQueue: (count) => `keep edited queue of ${count}`,
      recoverySessionQueue: (count) => `keep session order of ${count}`,
      recoveryShuffleQueue: 'new shuffle order',
      recoverySavedQueue: 'saved list order',
      recoveryNextSummary: 'Retry the next clip in the current playback session.',
      recoveryStopSummary: 'Stop and clear the current playback session.',
      stopRecoveryAria: 'Stop playback',
      connectionLost: 'Cannot connect to the YouTube tab. Reconnect or stop playback.',
      noPlaybackTab: 'Cannot find the active YouTube playback tab.',
      currentSegmentMissing: 'Cannot find the current playback range.',
      contentRequestFailed: 'Cannot connect to the YouTube page. Refresh it and try again.',
      runtimeUnavailable: 'Cannot connect to the extension background. Try again in a moment.',
      unsupportedRequest: 'Unsupported playback request.',
      unknownError: 'An unknown playback error occurred.',
      startFailed: (message) => `Cannot start playback. ${message}`,
      nextFailed: (message) => `Cannot move to the next clip. ${message}`,
      seekFailed: (message) => `Cannot seek playback. ${message}`,
      pauseFailed: (message) => `Cannot pause playback. ${message}`,
      resumeFailed: (message) => `Cannot resume playback. ${message}`,
      stopFailed: (message) => `Cannot stop playback. ${message}`,
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      languageHelp: 'Controls the app display language.',
      languageCode: 'EN',
      Korean: '한국어',
      English: 'English',
      Japanese: '日本語',
      accentColor: 'Accent color',
      accentHelp: 'Used for playback, saving, and active states.',
      selectPalette: (name) => `Select ${name}`,
      turnOn: 'turn on',
      turnOff: 'turn off',
      playback: 'Playback',
      autoNext: 'Auto-play next',
      autoNextHelp: 'Move to the next clip when a range ends',
      fadeOut: '0.3s fade at range end',
      fadeOutHelp: 'Smooth the cutoff',
      shuffleByDefault: 'Shuffle on start by default',
      capture: 'Capture',
      shortcutIn: 'Shortcut — IN',
      shortcutOut: 'Shortcut — OUT + save',
      shortcutHelp: 'Change these in Chrome extension shortcuts.',
      defaultSaveLocation: 'Default save location',
      defaultSaveLocationSelect: 'Choose default save location',
      autoTitle: 'Infer title on OUT',
      autoTitleHelp: 'Extract from captions and chapters',
      data: 'Data',
      export: 'Export',
      exportJson: 'JSON',
      exportCsv: 'CSV',
      import: 'Import',
      importHelp: 'Replace from a JSON backup',
      deleteAllClips: 'Delete all clips',
      deleteAllClipsHelp: 'Clear mixtapes and saved ranges.',
      deleteAllClipsConfirm: (clipCount) => `Delete ${clipCount} saved clip${clipCount === 1 ? '' : 's'} and all mixtapes?`,
      exportReady: (format) => `${format.toUpperCase()} export is ready.`,
      importReady: (mixtapeCount) => `Imported ${mixtapeCount} mixtape${mixtapeCount === 1 ? '' : 's'}.`,
      importFailed: 'This JSON file cannot be imported.',
      deleteAllDone: 'Deleted all clips.',
    },
    detail: {
      title: 'Detailed editing is planned for M2',
      copy: 'Clip titles, notes, tags, and fine-tuning land in the next milestone.',
    },
    content: {
      continuePrompt: 'Continue SnackTape playback?',
      continueButton: 'Continue',
      retryPrompt: 'Click the YouTube player once, then try again.',
      retryButton: 'Try again',
    },
  },
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function createI18n(language: unknown = 'ko'): I18n {
  const resolved = isLanguage(language) ? language : 'ko';
  return {
    language: resolved,
    ...TRANSLATIONS[resolved],
  };
}
