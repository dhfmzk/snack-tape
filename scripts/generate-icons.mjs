import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const OUT_DIR = 'public/icons';
const ICON_SIZES = [16, 32, 48, 128];
const SAMPLE_GRID = 4;

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function over(base, layer) {
  const alpha = layer[3] + base[3] * (1 - layer[3]);
  if (alpha <= 0) {
    return [0, 0, 0, 0];
  }

  return [
    (layer[0] * layer[3] + base[0] * base[3] * (1 - layer[3])) / alpha,
    (layer[1] * layer[3] + base[1] * base[3] * (1 - layer[3])) / alpha,
    (layer[2] * layer[3] + base[2] * base[3] * (1 - layer[3])) / alpha,
    alpha
  ];
}

function roundedRect(x, y, rectX, rectY, width, height, radius) {
  const cx = Math.max(rectX + radius, Math.min(x, rectX + width - radius));
  const cy = Math.max(rectY + radius, Math.min(y, rectY + height - radius));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function circle(x, y, cx, cy, radius) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function triangle(x, y, ax, ay, bx, by, cx, cy) {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const s = ((ay - cy) * (x - cx) + (cx - ax) * (y - cy)) / area;
  const t = ((cy - by) * (x - cx) + (bx - cx) * (y - cy)) / area;
  const u = 1 - s - t;
  return s >= 0 && t >= 0 && u >= 0;
}

function sampleIcon(x, y) {
  let color = [0, 0, 0, 0];
  if (roundedRect(x, y, 0, 0, 128, 128, 28)) {
    color = over(color, [255, 143, 130, 1]);
  }

  if (roundedRect(x, y, 24, 40, 80, 48, 13)) {
    color = over(color, [255, 248, 243, 1]);
  }
  if (circle(x, y, 48, 62, 8) || circle(x, y, 80, 62, 8)) {
    color = over(color, [26, 17, 18, 1]);
  }
  if (triangle(x, y, 58, 76, 76, 84, 58, 92)) {
    color = over(color, [26, 17, 18, 1]);
  }

  return color;
}

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

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function png(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const invSamples = 1 / (SAMPLE_GRID * SAMPLE_GRID);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let mixed = [0, 0, 0, 0];
      for (let sy = 0; sy < SAMPLE_GRID; sy += 1) {
        for (let sx = 0; sx < SAMPLE_GRID; sx += 1) {
          const x = ((px + (sx + 0.5) / SAMPLE_GRID) / size) * 128;
          const y = ((py + (sy + 0.5) / SAMPLE_GRID) / size) * 128;
          const sample = sampleIcon(x, y);
          mixed[0] += sample[0] * invSamples;
          mixed[1] += sample[1] * invSamples;
          mixed[2] += sample[2] * invSamples;
          mixed[3] += sample[3] * invSamples;
        }
      }

      const index = (py * size + px) * 4;
      rgba[index] = clamp(mixed[0]);
      rgba[index + 1] = clamp(mixed[1]);
      rgba[index + 2] = clamp(mixed[2]);
      rgba[index + 3] = clamp(mixed[3] * 255);
    }
  }
  return png(size, size, rgba);
}

await mkdir(OUT_DIR, { recursive: true });
await Promise.all(ICON_SIZES.map((size) => writeFile(`${OUT_DIR}/icon-${size}.png`, renderIcon(size))));
