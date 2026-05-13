import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DIST_DIR = 'dist';
const RELEASE_DIR = 'release';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTimestamp(date) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds
  };
}

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const sourcePath = join(directory, entry.name);
    const archivePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...await collectFiles(sourcePath, archivePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({ sourcePath, archivePath });
    }
  }

  return files;
}

function createLocalHeader(entry) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(entry.time, 10);
  header.writeUInt16LE(entry.date, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.data.length, 18);
  header.writeUInt32LE(entry.data.length, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, entry.name, entry.data]);
}

function createCentralHeader(entry) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(entry.time, 12);
  header.writeUInt16LE(entry.date, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.data.length, 20);
  header.writeUInt32LE(entry.data.length, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  return Buffer.concat([header, entry.name]);
}

function createEndOfCentralDirectory(entryCount, centralSize, centralOffset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

async function createZipArchive(sourceDirectory, archivePath) {
  const files = await collectFiles(sourceDirectory);
  const entries = [];
  let offset = 0;

  for (const file of files) {
    const data = await readFile(file.sourcePath);
    const timestamp = dosTimestamp(new Date());
    const entry = {
      ...file,
      name: Buffer.from(file.archivePath),
      data,
      crc: crc32(data),
      offset,
      ...timestamp
    };
    const localHeader = createLocalHeader(entry);
    entries.push({ entry, localHeader });
    offset += localHeader.length;
  }

  const centralHeaders = entries.map(({ entry }) => createCentralHeader(entry));
  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((total, header) => total + header.length, 0);
  const endRecord = createEndOfCentralDirectory(entries.length, centralSize, centralOffset);

  await writeFile(archivePath, Buffer.concat([
    ...entries.map(({ localHeader }) => localHeader),
    ...centralHeaders,
    endRecord
  ]));
}

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const archiveName = `snacktape-v${packageJson.version}.zip`;
const archivePath = resolve(RELEASE_DIR, archiveName);

await mkdir(RELEASE_DIR, { recursive: true });
await rm(archivePath, { force: true });
await createZipArchive(DIST_DIR, archivePath);

console.log(`Created ${RELEASE_DIR}/${archiveName}`);
