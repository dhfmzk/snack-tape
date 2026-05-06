function isIntegerPart(value: string): boolean {
  return /^\d+$/.test(value);
}

export function parseTimeToSeconds(input: string): number | null {
  const value = input.trim();

  if (!value || value.startsWith('-')) {
    return null;
  }

  if (isIntegerPart(value)) {
    return Number(value);
  }

  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !isIntegerPart(part))) {
    return null;
  }

  const numbers = parts.map(Number);
  const minutes = parts.length === 2 ? numbers[0] : numbers[1];
  const seconds = parts.length === 2 ? numbers[1] : numbers[2];

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  if (parts.length === 2) {
    return minutes * 60 + seconds;
  }

  return numbers[0] * 3600 + minutes * 60 + seconds;
}

export function formatSeconds(seconds: number): string {
  const normalized = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const rest = normalized % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(rest).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

export function formatTimecode(seconds: number): string {
  const normalized = Math.max(0, seconds);
  const wholeSeconds = Math.floor(normalized);
  const hundredths = Math.floor((normalized - wholeSeconds) * 100);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const rest = wholeSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(rest).padStart(2, '0');
  const paddedHundredths = String(hundredths).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}.${paddedHundredths}`;
}
