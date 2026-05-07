import { formatSeconds } from '../shared/time.js';
import { T_THUMBS_BY_KEY, type ThemeKey } from '../theme/tokens.js';
import { el } from './dom.js';

type ThumbProps = {
  themeKey: ThemeKey;
  videoId?: string | null;
  variant?: number;
  duration?: number | null;
  className?: string;
};

export function youtubeThumbUrl(videoId: string | null | undefined): string | null {
  return videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg` : null;
}

export function Thumb({ themeKey, videoId, variant = 0, duration = null, className = '' }: ThumbProps): HTMLElement {
  const backgrounds = T_THUMBS_BY_KEY[themeKey];
  const thumb = el('div', { className: `thumb ${className}`.trim() });
  thumb.style.background = backgrounds[variant % backgrounds.length];

  const imageUrl = youtubeThumbUrl(videoId);
  if (imageUrl) {
    let image: HTMLImageElement;
    image = el('img', {
      src: imageUrl,
      alt: '',
      loading: 'lazy',
      onError: () => {
        thumb.dataset.thumbFailed = 'true';
        image.remove();
      },
      style: {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      },
    });
    thumb.append(image);
  }

  if (duration !== null && Number.isFinite(duration)) {
    thumb.append(el('span', { className: 'thumb-duration', text: formatSeconds(duration) }));
  }

  thumb.append(el('span', { className: 'thumb-vignette' }));
  return thumb;
}
