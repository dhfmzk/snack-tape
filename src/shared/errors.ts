import type { SnackTapeErrorCode, SnackTapeResponse } from './types.js';

export class SnackTapeError extends Error {
  readonly code: SnackTapeErrorCode;

  constructor(code: SnackTapeErrorCode, message: string) {
    super(message);
    this.name = 'SnackTapeError';
    this.code = code;
  }
}

export function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === 'string' ? error : 'Unknown playback error';
}

export function errorCodeFromUnknown(error: unknown): SnackTapeErrorCode {
  return error instanceof SnackTapeError ? error.code : 'unknown';
}

export function failureResponse(error: unknown): SnackTapeResponse {
  return {
    ok: false,
    error: errorMessageFromUnknown(error),
    errorCode: errorCodeFromUnknown(error),
  };
}
