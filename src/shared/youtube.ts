const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

function cleanVideoId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const id = value.trim();
  return VIDEO_ID_PATTERN.test(id) ? id : null;
}

export function parseYouTubeVideoId(input: string): string | null {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be') {
    return cleanVideoId(url.pathname.split('/').filter(Boolean)[0] ?? null);
  }

  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com';

  if (!isYouTubeHost) {
    return null;
  }

  if (url.pathname === '/watch') {
    return cleanVideoId(url.searchParams.get('v'));
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if ((parts[0] === 'shorts' || parts[0] === 'embed') && parts[1]) {
    return cleanVideoId(parts[1]);
  }

  return null;
}
