import { describe, expect, test } from 'vitest';
import zlib from 'node:zlib';
import { createImageData, encodePng, hexToRgb, parseAnsi, render } from '../src/lib.js';

function parsePng(buffer) {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === 'IDAT') {
      idatChunks.push(data);
    }
    if (type === 'IEND') {
      break;
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const srcStart = y * (stride + 1) + 1;
    raw.copy(rgba, y * stride, srcStart, srcStart + stride);
  }

  return { width, height, rgba };
}

function pixelAt(image, x, y) {
  const idx = (y * image.width + x) * 4;
  return {
    r: image.rgba[idx],
    g: image.rgba[idx + 1],
    b: image.rgba[idx + 2],
    a: image.rgba[idx + 3],
  };
}

describe('parseAnsi', () => {
  test('parses plain text into cells', () => {
    const lines = parseAnsi('abc', { fg: '#dddddd' });
    expect(lines).toHaveLength(1);
    expect(lines[0].map((cell) => cell.char).join('')).toBe('abc');
  });

  test('applies foreground color and reset', () => {
    const lines = parseAnsi('\u001b[31mr\u001b[0mx', { fg: '#dddddd' });
    expect(lines[0][0]).toMatchObject({ char: 'r', fg: '#cd3131' });
    expect(lines[0][1]).toMatchObject({ char: 'x', fg: '#dddddd' });
  });

  test('applies background color and bold', () => {
    const lines = parseAnsi('\u001b[44;1mA', { fg: '#dddddd' });
    expect(lines[0][0]).toMatchObject({ char: 'A', bg: '#2472c8', bold: true });
  });

  test('handles cursor positioning', () => {
    const lines = parseAnsi('ab\u001b[2;3Hc', { fg: '#dddddd' });
    expect(lines[0].map((cell) => cell.char).join('')).toBe('ab');
    expect(lines[1][2]).toMatchObject({ char: 'c' });
  });

  test('handles erase to end of line', () => {
    const lines = parseAnsi('abcd\rxy\u001b[K', { fg: '#dddddd' });
    expect(lines[0].map((cell) => cell.char).join('')).toBe('xy');
  });
});

describe('png helpers', () => {
  test('hexToRgb converts hex colors', () => {
    expect(hexToRgb('#abc')).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb('#123456')).toEqual({ r: 18, g: 52, b: 86 });
  });

  test('createImageData fills background', () => {
    const data = createImageData(2, 1, '#112233');
    expect([...data]).toEqual([17, 34, 51, 255, 17, 34, 51, 255]);
  });

  test('encodePng writes valid dimensions', () => {
    const png = encodePng(2, 3, createImageData(2, 3, '#000000'));
    const image = parsePng(png);
    expect(image.width).toBe(2);
    expect(image.height).toBe(3);
  });
});

describe('render', () => {
  test('renders background and text into a PNG', () => {
    const lines = parseAnsi('\u001b[41mA', { fg: '#dddddd' });
    const png = render(lines, {
      fontSize: 16,
      lineHeight: 1.2,
      padding: 4,
      bg: '#111111',
      fg: '#dddddd',
      width: 0,
    });

    const image = parsePng(png);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);

    const bgPixel = pixelAt(image, 0, 0);
    expect(bgPixel).toMatchObject({ r: 17, g: 17, b: 17, a: 255 });

    let hasRedBackground = false;
    let hasNonBackgroundPixel = false;

    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const pixel = pixelAt(image, x, y);
        if (pixel.r === 205 && pixel.g === 49 && pixel.b === 49) {
          hasRedBackground = true;
        }
        if (!(pixel.r === 17 && pixel.g === 17 && pixel.b === 17)) {
          hasNonBackgroundPixel = true;
        }
      }
    }

    expect(hasRedBackground).toBe(true);
    expect(hasNonBackgroundPixel).toBe(true);
  });

  test('respects minimum width option', () => {
    const lines = parseAnsi('A', { fg: '#dddddd' });
    const png = render(lines, {
      fontSize: 16,
      lineHeight: 1.2,
      padding: 4,
      bg: '#111111',
      fg: '#dddddd',
      width: 10,
    });

    const image = parsePng(png);
    expect(image.width).toBe(4 * 2 + 10 * Math.max(8, Math.round(16 * 0.65)));
  });
});
