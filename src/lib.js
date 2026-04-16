import zlib from 'node:zlib';

export const ANSI_COLORS = {
  30: '#000000', 31: '#cd3131', 32: '#0dbc79', 33: '#e5e510',
  34: '#2472c8', 35: '#bc3fbc', 36: '#11a8cd', 37: '#e5e5e5',
  90: '#666666', 91: '#f14c4c', 92: '#23d18b', 93: '#f5f543',
  94: '#3b8eea', 95: '#d670d6', 96: '#29b8db', 97: '#ffffff',
  40: '#000000', 41: '#cd3131', 42: '#0dbc79', 43: '#e5e510',
  44: '#2472c8', 45: '#bc3fbc', 46: '#11a8cd', 47: '#e5e5e5',
  100: '#666666', 101: '#f14c4c', 102: '#23d18b', 103: '#f5f543',
  104: '#3b8eea', 105: '#d670d6', 106: '#29b8db', 107: '#ffffff',
};

export function parseAnsi(input, defaults) {
  const lines = [[]];
  let row = 0;
  let col = 0;
  let state = { fg: defaults.fg, bg: null, bold: false };

  function ensureCell(targetRow, targetCol) {
    while (lines.length <= targetRow) lines.push([]);
    const line = lines[targetRow];
    while (line.length <= targetCol) {
      line.push({ char: ' ', fg: defaults.fg, bg: null, bold: false });
    }
    return line[targetRow === row ? targetCol : targetCol];
  }

  function writeChar(char) {
    const cell = ensureCell(row, col);
    cell.char = char;
    cell.fg = state.fg;
    cell.bg = state.bg;
    cell.bold = state.bold;
    col += 1;
  }

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (ch === '\u001b' && input[i + 1] === '[') {
      let j = i + 2;
      let params = '';
      while (j < input.length && !/[A-Za-z]/.test(input[j])) {
        params += input[j];
        j += 1;
      }
      const command = input[j];
      const values = params.split(';').filter(Boolean).map(Number);

      if (command === 'm') {
        const codes = values.length ? values : [0];
        for (const code of codes) {
          if (code === 0) state = { fg: defaults.fg, bg: null, bold: false };
          else if (code === 1) state.bold = true;
          else if (code === 22) state.bold = false;
          else if (code === 39) state.fg = defaults.fg;
          else if (code === 49) state.bg = null;
          else if (ANSI_COLORS[code]) {
            if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) state.fg = ANSI_COLORS[code];
            if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) state.bg = ANSI_COLORS[code];
          }
        }
      } else if (command === 'K') {
        lines[row] = lines[row].slice(0, col);
      } else if (command === 'H' || command === 'f') {
        row = Math.max(0, (values[0] || 1) - 1);
        col = Math.max(0, (values[1] || 1) - 1);
      }

      i = j;
      continue;
    }

    if (ch === '\n') {
      row += 1;
      col = 0;
      while (lines.length <= row) lines.push([]);
      continue;
    }

    if (ch === '\r') {
      col = 0;
      continue;
    }

    if (ch === '\t') {
      const spaces = 4 - (col % 4 || 4);
      for (let s = 0; s < spaces; s += 1) writeChar(' ');
      continue;
    }

    writeChar(ch);
  }

  return lines;
}

export function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function createImageData(width, height, bgHex) {
  const { r, g, b } = hexToRgb(bgHex);
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

function fillRect(data, imageWidth, x, y, w, h, hex) {
  const { r, g, b } = hexToRgb(hex);
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= imageWidth) continue;
      const idx = (yy * imageWidth + xx) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
}

const GLYPHS = {
  ' ': ['000','000','000','000','000','000','000'],
  '.': ['000','000','000','000','000','110','110'],
  '-': ['000','000','000','111','000','000','000'],
  '_': ['000','000','000','000','000','000','111'],
  '/': ['001','001','010','010','100','100','000'],
  ':': ['000','010','000','000','000','010','000'],
  '[': ['110','100','100','100','100','100','110'],
  ']': ['011','001','001','001','001','001','011'],
};

for (let n = 0; n <= 9; n += 1) {
  Object.assign(GLYPHS, {
    [String(n)]: [
      ['111','101','101','101','101','101','111'],
      ['010','110','010','010','010','010','111'],
      ['111','001','001','111','100','100','111'],
      ['111','001','001','111','001','001','111'],
      ['101','101','101','111','001','001','001'],
      ['111','100','100','111','001','001','111'],
      ['111','100','100','111','101','101','111'],
      ['111','001','001','010','010','010','010'],
      ['111','101','101','111','101','101','111'],
      ['111','101','101','111','001','001','111'],
    ][n],
  });
}

const LETTERS = {
  A: ['010','101','101','111','101','101','101'],
  B: ['110','101','101','110','101','101','110'],
  C: ['011','100','100','100','100','100','011'],
  D: ['110','101','101','101','101','101','110'],
  E: ['111','100','100','110','100','100','111'],
  F: ['111','100','100','110','100','100','100'],
  G: ['011','100','100','101','101','101','011'],
  H: ['101','101','101','111','101','101','101'],
  I: ['111','010','010','010','010','010','111'],
  J: ['001','001','001','001','101','101','010'],
  K: ['101','101','110','100','110','101','101'],
  L: ['100','100','100','100','100','100','111'],
  M: ['101','111','111','101','101','101','101'],
  N: ['101','111','111','111','111','111','101'],
  O: ['010','101','101','101','101','101','010'],
  P: ['110','101','101','110','100','100','100'],
  Q: ['010','101','101','101','111','011','001'],
  R: ['110','101','101','110','110','101','101'],
  S: ['011','100','100','010','001','001','110'],
  T: ['111','010','010','010','010','010','010'],
  U: ['101','101','101','101','101','101','111'],
  V: ['101','101','101','101','101','101','010'],
  W: ['101','101','101','101','111','111','101'],
  X: ['101','101','101','010','101','101','101'],
  Y: ['101','101','101','010','010','010','010'],
  Z: ['111','001','001','010','100','100','111'],
};

for (const [letter, glyph] of Object.entries(LETTERS)) {
  GLYPHS[letter] = glyph;
  GLYPHS[letter.toLowerCase()] = glyph;
}

function drawGlyph(data, imageWidth, x, y, cellWidth, cellHeight, char, colorHex, bold) {
  const glyph = GLYPHS[char] || GLYPHS[char.toUpperCase()] || GLYPHS['?'] || ['111','001','010','010','010','000','010'];
  const { r, g, b } = hexToRgb(colorHex);
  const glyphWidth = glyph[0].length;
  const glyphHeight = glyph.length;
  const scaleX = Math.max(1, Math.floor(cellWidth / (glyphWidth + 1)));
  const scaleY = Math.max(1, Math.floor(cellHeight / glyphHeight));
  const offsetX = x + Math.max(0, Math.floor((cellWidth - glyphWidth * scaleX) / 2));
  const offsetY = y + Math.max(0, Math.floor((cellHeight - glyphHeight * scaleY) / 2));

  for (let gy = 0; gy < glyphHeight; gy += 1) {
    for (let gx = 0; gx < glyphWidth; gx += 1) {
      if (glyph[gy][gx] !== '1') continue;
      const drawWidth = bold ? scaleX + 1 : scaleX;
      for (let sy = 0; sy < scaleY; sy += 1) {
        for (let sx = 0; sx < drawWidth; sx += 1) {
          const xx = offsetX + gx * scaleX + sx;
          const yy = offsetY + gy * scaleY + sy;
          const idx = (yy * imageWidth + xx) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
    }
  }
}

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuffer), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function encodePng(width, height, rgbaData) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgbaData.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function render(lines, options) {
  const cellWidth = Math.max(8, Math.round(options.fontSize * 0.65));
  const cellHeight = Math.max(12, Math.round(options.fontSize * options.lineHeight));
  const cols = Math.max(options.width, ...lines.map((line) => line.length), 1);
  const rows = Math.max(lines.length, 1);
  const width = options.padding * 2 + cols * cellWidth;
  const height = options.padding * 2 + rows * cellHeight;
  const data = createImageData(width, height, options.bg);

  for (let row = 0; row < rows; row += 1) {
    const line = lines[row] || [];
    for (let col = 0; col < cols; col += 1) {
      const cell = line[col] || { char: ' ', fg: options.fg, bg: null, bold: false };
      const x = options.padding + col * cellWidth;
      const y = options.padding + row * cellHeight;
      if (cell.bg) {
        fillRect(data, width, x, y, cellWidth, cellHeight, cell.bg);
      }
      if (cell.char !== ' ') {
        drawGlyph(data, width, x, y, cellWidth, cellHeight, cell.char, cell.fg, cell.bold);
      }
    }
  }

  return encodePng(width, height, data);
}
