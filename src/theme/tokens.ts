export type Theme = {
  name: string;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  hairline: string;
  hairline2: string;
  text: string;
  text2: string;
  mute: string;
  mute2: string;
  accent: string;
  accent2: string;
  accentDim: string;
  accentInk: string;
  accentSoft: string;
  accentGlow: string;
  rec: string;
};

export const T_PEACH = {
  name: 'Peach Sorbet',
  bg: '#100c0a', surface: '#1a1410', surface2: '#221a14', surface3: '#2e231a',
  hairline: '#2c2218', hairline2: '#3e2f22',
  text: '#fbf3ec', text2: '#d4c4b5', mute: '#8a7868', mute2: '#5e4f42',
  accent: '#ffb088', accent2: '#ffd1a8', accentDim: '#e89970', accentInk: '#1f140a',
  accentSoft: 'rgba(255,176,136,0.14)', accentGlow: 'rgba(255,176,136,0.50)',
  rec: '#ff6b6b',
} satisfies Theme;

export const T_CORAL = {
  name: 'Soft Coral',
  bg: '#120c0c', surface: '#1c1414', surface2: '#251a1a', surface3: '#332222',
  hairline: '#2e2020', hairline2: '#422c2c',
  text: '#fbf0ee', text2: '#d8bfb8', mute: '#8a7268', mute2: '#5e4844',
  accent: '#ff9a8a', accent2: '#ffc1b0', accentDim: '#e8826e', accentInk: '#220e0a',
  accentSoft: 'rgba(255,154,138,0.14)', accentGlow: 'rgba(255,154,138,0.55)',
  rec: '#ff5a5f',
} satisfies Theme;

export const T_BUTTER = {
  name: 'Butter Cream',
  bg: '#100e08', surface: '#1a160e', surface2: '#221d12', surface3: '#2e2818',
  hairline: '#2a2418', hairline2: '#3c3422',
  text: '#fbf6e8', text2: '#d4c8a8', mute: '#8a7e60', mute2: '#5e5440',
  accent: '#f5d77a', accent2: '#ffe8a8', accentDim: '#d8b85e', accentInk: '#1f180a',
  accentSoft: 'rgba(245,215,122,0.13)', accentGlow: 'rgba(245,215,122,0.50)',
  rec: '#ff7a6e',
} satisfies Theme;

export const T_SEAFOAM = {
  name: 'Sea Foam',
  bg: '#0a1110', surface: '#101a18', surface2: '#142421', surface3: '#1c2f2b',
  hairline: '#1a2c28', hairline2: '#2a423c',
  text: '#ecf6f3', text2: '#b4ccc4', mute: '#728a82', mute2: '#4f625b',
  accent: '#9ae6c7', accent2: '#c8f0dc', accentDim: '#7cc8a8', accentInk: '#0a1f18',
  accentSoft: 'rgba(154,230,199,0.13)', accentGlow: 'rgba(154,230,199,0.50)',
  rec: '#ff7a8a',
} satisfies Theme;

export const T_SKY = {
  name: 'Sky Glow',
  bg: '#0a0e12', surface: '#10161e', surface2: '#161e2a', surface3: '#1f2a3a',
  hairline: '#1c2632', hairline2: '#2c3a4a',
  text: '#ecf2fa', text2: '#b8c8d8', mute: '#728294', mute2: '#4f5c6e',
  accent: '#a8d8ff', accent2: '#c8e8ff', accentDim: '#8ab8e0', accentInk: '#08121e',
  accentSoft: 'rgba(168,216,255,0.14)', accentGlow: 'rgba(168,216,255,0.50)',
  rec: '#ff8a8a',
} satisfies Theme;

export const THEMES = {
  peach: T_PEACH,
  coral: T_CORAL,
  butter: T_BUTTER,
  seafoam: T_SEAFOAM,
  sky: T_SKY,
} as const;

export type ThemeKey = keyof typeof THEMES;

export const THEME_KEYS = ['peach', 'coral', 'butter', 'seafoam', 'sky'] as const;

export const SNACKTAPE_PALETTE = [
  { key: 'peach', name: 'Peach Sorbet', hex: '#ffb088' },
  { key: 'coral', name: 'Soft Coral', hex: '#ff9a8a' },
  { key: 'butter', name: 'Butter Cream', hex: '#f5d77a' },
  { key: 'seafoam', name: 'Sea Foam', hex: '#9ae6c7' },
  { key: 'sky', name: 'Sky Glow', hex: '#a8d8ff' },
] as const;

export const T_THUMBS_PEACH = [
  'radial-gradient(ellipse 80% 60% at 30% 40%, #d4856a 0%, transparent 60%), radial-gradient(ellipse 90% 70% at 70% 70%, #b86848 0%, transparent 65%), linear-gradient(135deg, #2a1a14 0%, #2e1812 100%)',
  'radial-gradient(ellipse 70% 80% at 60% 30%, #c87858 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 30% 80%, #a85a3a 0%, transparent 65%), linear-gradient(160deg, #25160e 0%, #2a1a10 100%)',
  'radial-gradient(ellipse 90% 60% at 50% 40%, #b86848 0%, transparent 65%), radial-gradient(ellipse 70% 80% at 80% 70%, #c89060 0%, transparent 60%), linear-gradient(120deg, #1f1610 0%, #2a1a10 100%)',
  'radial-gradient(ellipse 80% 70% at 40% 60%, #d4906a 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 70% 30%, #a85a3a 0%, transparent 60%), linear-gradient(135deg, #20140e 0%, #2a1812 100%)',
];

export const T_THUMBS_CORAL = [
  'radial-gradient(ellipse 80% 60% at 30% 40%, #d47868 0%, transparent 60%), radial-gradient(ellipse 90% 70% at 70% 70%, #b85a4a 0%, transparent 65%), linear-gradient(135deg, #2a1614 0%, #2e1818 100%)',
  'radial-gradient(ellipse 70% 80% at 60% 30%, #c86858 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 30% 80%, #a8503a 0%, transparent 65%), linear-gradient(160deg, #251210 0%, #2a1614 100%)',
  'radial-gradient(ellipse 90% 60% at 50% 40%, #b85a4a 0%, transparent 65%), radial-gradient(ellipse 70% 80% at 80% 70%, #c87060 0%, transparent 60%), linear-gradient(120deg, #1f1210 0%, #2a1614 100%)',
  'radial-gradient(ellipse 80% 70% at 40% 60%, #d47868 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 70% 30%, #a8503a 0%, transparent 60%), linear-gradient(135deg, #20100e 0%, #2a1614 100%)',
];

export const T_THUMBS_BUTTER = [
  'radial-gradient(ellipse 80% 60% at 30% 40%, #c8a850 0%, transparent 60%), radial-gradient(ellipse 90% 70% at 70% 70%, #a88a3a 0%, transparent 65%), linear-gradient(135deg, #2a2210 0%, #2e2412 100%)',
  'radial-gradient(ellipse 70% 80% at 60% 30%, #b89840 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 30% 80%, #d4b260 0%, transparent 65%), linear-gradient(160deg, #251e0e 0%, #2a2210 100%)',
  'radial-gradient(ellipse 90% 60% at 50% 40%, #d4b860 0%, transparent 65%), radial-gradient(ellipse 70% 80% at 80% 70%, #a88a3a 0%, transparent 60%), linear-gradient(120deg, #1f1a0e 0%, #2a2210 100%)',
  'radial-gradient(ellipse 80% 70% at 40% 60%, #c8a850 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 70% 30%, #b89840 0%, transparent 60%), linear-gradient(135deg, #20180a 0%, #2a2210 100%)',
];

export const T_THUMBS_SEAFOAM = [
  'radial-gradient(ellipse 80% 60% at 30% 40%, #4a8a78 0%, transparent 60%), radial-gradient(ellipse 90% 70% at 70% 70%, #386a5a 0%, transparent 65%), linear-gradient(135deg, #0e2520 0%, #102a25 100%)',
  'radial-gradient(ellipse 70% 80% at 60% 30%, #3a7868 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 30% 80%, #4a8a72 0%, transparent 65%), linear-gradient(160deg, #0a1f1a 0%, #122520 100%)',
  'radial-gradient(ellipse 90% 60% at 50% 40%, #5a9882 0%, transparent 65%), radial-gradient(ellipse 70% 80% at 80% 70%, #386a5a 0%, transparent 60%), linear-gradient(120deg, #0e2018 0%, #142a22 100%)',
  'radial-gradient(ellipse 80% 70% at 40% 60%, #4a8a72 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 70% 30%, #5a9882 0%, transparent 60%), linear-gradient(135deg, #0a1f18 0%, #102520 100%)',
];

export const T_THUMBS_SKY = [
  'radial-gradient(ellipse 80% 60% at 30% 40%, #5a8ac8 0%, transparent 60%), radial-gradient(ellipse 90% 70% at 70% 70%, #4878b0 0%, transparent 65%), linear-gradient(135deg, #0e1a2a 0%, #10202e 100%)',
  'radial-gradient(ellipse 70% 80% at 60% 30%, #4878a8 0%, transparent 60%), radial-gradient(ellipse 80% 60% at 30% 80%, #6098c8 0%, transparent 65%), linear-gradient(160deg, #0a1625 0%, #121e2a 100%)',
  'radial-gradient(ellipse 90% 60% at 50% 40%, #6098c8 0%, transparent 65%), radial-gradient(ellipse 70% 80% at 80% 70%, #4878a8 0%, transparent 60%), linear-gradient(120deg, #0e1a25 0%, #14202a 100%)',
  'radial-gradient(ellipse 80% 70% at 40% 60%, #5a8ac8 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 70% 30%, #4878a8 0%, transparent 60%), linear-gradient(135deg, #0a1620 0%, #10202a 100%)',
];

export const T_THUMBS_BY_KEY = {
  peach: T_THUMBS_PEACH,
  coral: T_THUMBS_CORAL,
  butter: T_THUMBS_BUTTER,
  seafoam: T_THUMBS_SEAFOAM,
  sky: T_THUMBS_SKY,
} as const;

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && value in THEMES;
}
