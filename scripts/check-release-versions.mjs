import { readFile } from 'node:fs/promises';

const [packageJson, manifest] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('manifest.json', 'utf8').then(JSON.parse)
]);

if (packageJson.version !== manifest.version) {
  console.error(`Release version mismatch: package.json ${packageJson.version} != manifest.json ${manifest.version}`);
  process.exit(1);
}

console.log(`Release versions match: ${packageJson.version}`);
