import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const DOC_PATHS = [
  'README.md',
  'docs/chrome-web-store-screenshots.md',
  'docs/release-notes-template.md',
  'docs/snacktape-goal.md',
  'docs/permissions-audit.md',
  'docs/privacy.md'
];

test('Markdown documentation is written in English', async () => {
  for (const path of DOC_PATHS) {
    const text = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /[가-힣]/, `${path} still contains Korean copy`);
  }
});
