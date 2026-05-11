import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ZIP_UTF8_FLAG = 0x0800;
const ZIP_DEFLATE_METHOD = 8;

const crcTable = new Uint32Array(256);
for (let i = 0; i < crcTable.length; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const safeDate = date.getFullYear() < 1980 ? new Date('1980-01-01T00:00:00Z') : date;
  const dosTime = (safeDate.getHours() << 11)
    | (safeDate.getMinutes() << 5)
    | Math.floor(safeDate.getSeconds() / 2);
  const dosDate = ((safeDate.getFullYear() - 1980) << 9)
    | ((safeDate.getMonth() + 1) << 5)
    | safeDate.getDate();

  return { dosDate, dosTime };
}

function writeZipLocalHeader({ compressedSize, crc, dosDate, dosTime, name, size }) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 6);
  header.writeUInt16LE(ZIP_DEFLATE_METHOD, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressedSize, 18);
  header.writeUInt32LE(size, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function writeZipCentralHeader({ compressedSize, crc, dosDate, dosTime, name, offset, size }) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(ZIP_UTF8_FLAG, 8);
  header.writeUInt16LE(ZIP_DEFLATE_METHOD, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(compressedSize, 20);
  header.writeUInt32LE(size, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

function writeZipEndRecord({ centralDirectoryOffset, centralDirectorySize, fileCount }) {
  const header = Buffer.alloc(22);
  header.writeUInt32LE(0x06054b50, 0);
  header.writeUInt16LE(0, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(fileCount, 8);
  header.writeUInt16LE(fileCount, 10);
  header.writeUInt32LE(centralDirectorySize, 12);
  header.writeUInt32LE(centralDirectoryOffset, 16);
  header.writeUInt16LE(0, 20);
  return header;
}

export function sanitizeArtifactSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'artifact';
}

export async function collectDistFiles(distDir) {
  const baseDir = resolve(distDir);
  const files = [];

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const info = await stat(path);
      files.push({
        archivePath: relative(baseDir, path).split(sep).join('/'),
        absolutePath: path,
        modifiedAt: info.mtime
      });
    }
  }

  await walk(baseDir);
  return files;
}

export async function createZipArchive(files, outputPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.archivePath, 'utf8');
    const data = await readFile(file.absolutePath);
    const compressed = deflateRawSync(data);
    const { dosDate, dosTime } = toDosDateTime(file.modifiedAt ?? new Date());
    const checksum = crc32(data);
    const localHeader = writeZipLocalHeader({
      compressedSize: compressed.length,
      crc: checksum,
      dosDate,
      dosTime,
      name,
      size: data.length
    });
    const centralHeader = writeZipCentralHeader({
      compressedSize: compressed.length,
      crc: checksum,
      dosDate,
      dosTime,
      name,
      offset,
      size: data.length
    });

    localParts.push(localHeader, name, compressed);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce((total, part) => total + part.length, 0);
  const endRecord = writeZipEndRecord({
    centralDirectoryOffset,
    centralDirectorySize,
    fileCount: files.length
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.concat([...localParts, ...centralParts, endRecord]));
}

export async function buildReleasePackage({ rootDir = process.cwd(), distDir = 'dist', artifactDir = 'artifacts' } = {}) {
  const root = resolve(rootDir);
  const distPath = resolve(root, distDir);
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(distPath, 'manifest.json'), 'utf8'));

  if (manifest.manifest_version !== 3) {
    throw new Error(`${relative(root, resolve(distPath, 'manifest.json'))} is not a Chrome MV3 manifest`);
  }

  const files = await collectDistFiles(distPath);
  if (files.length === 0) {
    throw new Error(`${basename(distPath)} has no files to package`);
  }

  const artifactName = `${sanitizeArtifactSegment(packageJson.name)}-${sanitizeArtifactSegment(manifest.version)}.zip`;
  const artifactPath = resolve(root, artifactDir, artifactName);

  await rm(artifactPath, { force: true });
  await createZipArchive(files, artifactPath);

  return artifactPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifactPath = await buildReleasePackage();
  console.log(`Release artifact: ${artifactPath}`);
}
