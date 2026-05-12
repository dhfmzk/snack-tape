// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { THEME_KEYS, T_PEACH, THEMES } from '../src/theme/tokens.js';

test('T_PEACH matches the handoff theme token exactly', () => {
  assert.deepEqual(T_PEACH, {
    name: 'Peach Sorbet',
    bg: '#100c0a',
    surface: '#1a1410',
    surface2: '#221a14',
    surface3: '#2e231a',
    hairline: '#2c2218',
    hairline2: '#3e2f22',
    text: '#fbf3ec',
    text2: '#d4c4b5',
    mute: '#8a7868',
    mute2: '#5e4f42',
    accent: '#ffb088',
    accent2: '#ffd1a8',
    accentDim: '#e89970',
    accentInk: '#1f140a',
    accentSoft: 'rgba(255,176,136,0.14)',
    accentGlow: 'rgba(255,176,136,0.50)',
    rec: '#ff6b6b'
  });
});

test('theme registry exposes the five handoff accent options in order', () => {
  assert.deepEqual(THEME_KEYS, ['peach', 'coral', 'butter', 'seafoam', 'sky']);
  assert.deepEqual(
    THEME_KEYS.map((key) => THEMES[key].name),
    ['Peach Sorbet', 'Soft Coral', 'Butter Cream', 'Sea Foam', 'Sky Glow']
  );
});
