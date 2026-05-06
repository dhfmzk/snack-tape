export type Segment = {
  id: string;
  videoId: string;
  originalUrl: string;
  title: string;
  startSeconds: number;
  endSeconds: number | null;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type Sequence = {
  id: string;
  name: string;
  segments: Segment[];
  createdAt: number;
  updatedAt: number;
};

export type PlaybackState = {
  sequenceId: string;
  segmentIndex: number;
  tabId?: number;
  status: 'idle' | 'playing' | 'paused' | 'stopped';
  startedAt: number;
  playbackToken?: string;
};

export type PageInfo = {
  isYouTubeVideoPage: boolean;
  videoId: string | null;
  title: string;
  url: string;
  currentTime: number | null;
  duration: number | null;
};

export type SegmentDraft = {
  videoId: string;
  startSeconds: number | null;
  endSeconds: number | null;
  updatedAt: number;
};

export type SnackTapeStore = {
  sequences: Sequence[];
  selectedSequenceId: string | null;
};

export type SnackTapeMessage =
  | { type: 'GET_PAGE_INFO' }
  | { type: 'GET_CURRENT_TIME' }
  | { type: 'PLAY_SEGMENT'; segment: Segment; playbackToken: string }
  | { type: 'STOP_PLAYBACK' }
  | { type: 'SEGMENT_ENDED'; playbackToken: string }
  | { type: 'START_SEQUENCE'; sequenceId: string; startIndex?: number }
  | { type: 'PLAY_NEXT'; playbackToken?: string }
  | { type: 'STOP_SEQUENCE' }
  | { type: 'OPEN_EDITOR' };

export type SnackTapeResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};
