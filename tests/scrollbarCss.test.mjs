import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('side panel scrollbar uses theme tokens', async () => {
  const css = await readFile('src/sidepanel/sidepanel.css', 'utf8');

  assert.match(css, /scrollbar-color:\s*var\(--accent\)\s+var\(--surface\)/);
  assert.match(css, /\*::\-webkit\-scrollbar-thumb/);
  assert.match(css, /box-shadow:\s*0 0 10px var\(--accent-glow\)/);
});

