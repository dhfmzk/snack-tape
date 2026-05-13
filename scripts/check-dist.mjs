import { access, readFile, stat } from 'node:fs/promises';

const requiredFiles = [
  'dist/manifest.json',
  'dist/main.js',
  'dist/background.js',
  'dist/content.js',
  'dist/sidepanel.html',
  'dist/sidepanel.css',
  'dist/_locales/en/messages.json',
  'dist/_locales/ja/messages.json',
  'dist/_locales/ko/messages.json'
];

async function assertFile(path) {
  await access(path);
  const info = await stat(path);
  if (!info.isFile() || info.size === 0) {
    throw new Error(`${path} is missing or empty`);
  }
}

for (const file of requiredFiles) {
  await assertFile(file);
}

const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
const expectedPaths = [
  manifest.background?.service_worker,
  manifest.side_panel?.default_path,
  ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? [])
].filter(Boolean);

for (const path of expectedPaths) {
  await assertFile(`dist/${path}`);
}

if (manifest.manifest_version !== 3) {
  throw new Error('dist/manifest.json is not a Chrome MV3 manifest');
}

console.log('dist smoke check passed');
