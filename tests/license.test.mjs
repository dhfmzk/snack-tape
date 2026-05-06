import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('project declares the MIT license in package metadata and LICENSE', async () => {
  const [packageText, licenseText, readme] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../LICENSE', import.meta.url), 'utf8'),
    readFile(new URL('../README.md', import.meta.url), 'utf8')
  ]);
  const pkg = JSON.parse(packageText);

  assert.equal(pkg.license, 'MIT');
  assert.match(licenseText, /^MIT License/);
  assert.match(licenseText, /Copyright \(c\) 2026 SnackTape contributors/);
  assert.match(readme, /## License\s+MIT/);
});
