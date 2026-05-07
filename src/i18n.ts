export const LANGUAGES = ['ko', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export type I18n = {
  language: Language;
  app: {
    loading: string;
    deleteMixtapeConfirm: (name: string, clipCount: number) => string;
  };
  common: {
    noMixtape: string;
    unnamedMixtape: string;
    readingTitle: string;
    openYoutubeVideo: string;
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
    segmentEditDone: (title: string) => string;
    segmentEdit: string;
    done: string;
    start: string;
    end: string;
    captureInAria: string;
    captureOutAria: string;
    inButton: string;
    outButton: string;
    mark: string;
    now: string;
    inFirst: string;
    adjust: (label: string) => string;
    sessionSaved: (count: number) => string;
    currentlyCapturing: string;
    noticeOpenYoutubeVideo: string;
    noticeNoSaveTarget: string;
    noticeInFirst: string;
    noticeTimeUnavailable: string;
    noticeInvalidSegment: string;
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
    progress: string;
    shuffle: string;
    previous: string;
    stop: string;
    play: string;
    next: string;
    repeatCurrent: string;
    queue: string;
    editing: string;
    edit: string;
    editMixtape: string;
    editQueue: string;
    upNextCount: (count: number) => string;
    moveUp: (title: string) => string;
    moveDown: (title: string) => string;
    removeFromQueue: (title: string) => string;
    playSegment: (title: string) => string;
    cancelQueueEdit: string;
    saveQueueEdit: string;
    cancel: string;
    done: string;
  };
  settings: {
    title: string;
    language: string;
    languageHelp: string;
    languageCode: string;
    Korean: string;
    English: string;
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
};

const TRANSLATIONS: Record<Language, Omit<I18n, 'language'>> = {
  ko: {
    app: {
      loading: '불러오는 중...',
      deleteMixtapeConfirm: (name, clipCount) => `"${name}" 믹스테이프를 삭제할까요? 저장된 구간 ${clipCount}개도 함께 삭제됩니다.`,
    },
    common: {
      noMixtape: '믹스테이프 없음',
      unnamedMixtape: '믹스테이프',
      readingTitle: '제목을 읽는 중',
      openYoutubeVideo: 'YouTube 영상에서 열어주세요',
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
      segmentEditDone: (title) => `${title} 편집 완료`,
      segmentEdit: '구간 편집',
      done: '완료',
      start: '시작',
      end: '끝',
      captureInAria: 'IN 마커 찍기',
      captureOutAria: 'OUT 마커 찍고 추가',
      inButton: 'IN · I',
      outButton: 'OUT + 추가 · O',
      mark: '찍기',
      now: '지금',
      inFirst: 'IN 먼저',
      adjust: (label) => `${label} 조정`,
      sessionSaved: (count) => `이번 세션 · ${count}개 저장됨`,
      currentlyCapturing: '현재 캡처 중',
      noticeOpenYoutubeVideo: 'YouTube 영상에서 열어주세요.',
      noticeNoSaveTarget: '저장할 믹스테이프를 선택하세요.',
      noticeInFirst: 'IN 먼저 찍어주세요.',
      noticeTimeUnavailable: '영상 시간을 읽을 수 없습니다. 새로고침 후 다시 시도해주세요.',
      noticeInvalidSegment: '구간을 저장할 수 없습니다.',
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
      progress: '재생 진행률',
      shuffle: '셔플 재생',
      previous: '이전 클립',
      stop: '정지',
      play: '재생',
      next: '다음 클립',
      repeatCurrent: '현재 클립 다시 재생',
      queue: 'QUEUE',
      editing: '편집 중',
      edit: '편집',
      editMixtape: '믹스테이프 편집',
      editQueue: '큐 편집',
      upNextCount: (count) => `${count} UP NEXT`,
      moveUp: (title) => `${title} 위로 이동`,
      moveDown: (title) => `${title} 아래로 이동`,
      removeFromQueue: (title) => `${title} 큐에서 제거`,
      playSegment: (title) => `${title} 재생`,
      cancelQueueEdit: '큐 편집 취소',
      saveQueueEdit: '큐 편집 완료',
      cancel: '취소',
      done: '완료',
    },
    settings: {
      title: '설정',
      language: '언어',
      languageHelp: '앱 표시 언어입니다.',
      languageCode: 'KO',
      Korean: '한국어',
      English: 'English',
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
  },
  en: {
    app: {
      loading: 'Loading...',
      deleteMixtapeConfirm: (name, clipCount) => `Delete "${name}"? ${clipCount} saved clip${clipCount === 1 ? '' : 's'} will be deleted too.`,
    },
    common: {
      noMixtape: 'No mixtape',
      unnamedMixtape: 'Mixtape',
      readingTitle: 'Reading title',
      openYoutubeVideo: 'Open a YouTube video',
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
      segmentEditDone: (title) => `Finish editing ${title}`,
      segmentEdit: 'Edit range',
      done: 'Done',
      start: 'Start',
      end: 'End',
      captureInAria: 'Mark IN',
      captureOutAria: 'Mark OUT and add',
      inButton: 'IN · I',
      outButton: 'OUT + Add · O',
      mark: 'Mark',
      now: 'Now',
      inFirst: 'IN first',
      adjust: (label) => `Adjust ${label}`,
      sessionSaved: (count) => `This session · ${count} saved`,
      currentlyCapturing: 'Capturing now',
      noticeOpenYoutubeVideo: 'Open a YouTube video first.',
      noticeNoSaveTarget: 'Choose a save mixtape.',
      noticeInFirst: 'Mark IN first.',
      noticeTimeUnavailable: 'Cannot read the video time. Refresh YouTube and try again.',
      noticeInvalidSegment: 'Cannot save this range.',
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
      progress: 'Playback progress',
      shuffle: 'Shuffle play',
      previous: 'Previous clip',
      stop: 'Stop',
      play: 'Play',
      next: 'Next clip',
      repeatCurrent: 'Replay current clip',
      queue: 'QUEUE',
      editing: 'Editing',
      edit: 'Edit',
      editMixtape: 'Edit mixtape',
      editQueue: 'Edit queue',
      upNextCount: (count) => `${count} UP NEXT`,
      moveUp: (title) => `Move ${title} up`,
      moveDown: (title) => `Move ${title} down`,
      removeFromQueue: (title) => `Remove ${title} from queue`,
      playSegment: (title) => `Play ${title}`,
      cancelQueueEdit: 'Cancel queue edit',
      saveQueueEdit: 'Save queue edit',
      cancel: 'Cancel',
      done: 'Done',
    },
    settings: {
      title: 'Settings',
      language: 'Language',
      languageHelp: 'Controls the app display language.',
      languageCode: 'EN',
      Korean: '한국어',
      English: 'English',
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
