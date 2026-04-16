import zlib from 'node:zlib';
import { createCanvas } from 'canvas';

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

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export function ansi256ToHex(code) {
  if (code < 0 || code > 255 || Number.isNaN(code)) return null;

  if (code < 16) {
    const table = [
      '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
      '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
    ];
    return table[code];
  }

  if (code >= 16 && code <= 231) {
    const index = code - 16;
    const r = Math.floor(index / 36);
    const g = Math.floor((index % 36) / 6);
    const b = index % 6;
    const levels = [0, 95, 135, 175, 215, 255];
    return rgbToHex(levels[r], levels[g], levels[b]);
  }

  const level = 8 + (code - 232) * 10;
  return rgbToHex(level, level, level);
}

function applySgrCodes(codes, state, defaults) {
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];

    if (code === 0) state = { fg: defaults.fg, bg: null, bold: false };
    else if (code === 1) state.bold = true;
    else if (code === 22) state.bold = false;
    else if (code === 39) state.fg = defaults.fg;
    else if (code === 49) state.bg = null;
    else if (ANSI_COLORS[code]) {
      if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) state.fg = ANSI_COLORS[code];
      if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) state.bg = ANSI_COLORS[code];
    } else if (code === 38 || code === 48) {
      const mode = codes[index + 1];
      if (mode === 5) {
        const color = ansi256ToHex(codes[index + 2]);
        if (color) {
          if (code === 38) state.fg = color;
          else state.bg = color;
        }
        index += 2;
      } else if (mode === 2) {
        const r = codes[index + 2];
        const g = codes[index + 3];
        const b = codes[index + 4];
        if ([r, g, b].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
          const color = rgbToHex(r, g, b);
          if (code === 38) state.fg = color;
          else state.bg = color;
        }
        index += 4;
      }
    }
  }

  return state;
}

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
        state = applySgrCodes(codes, state, defaults);
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

function estimateCellWidth(fontSize) {
  return Math.max(8, Math.round(fontSize * 0.62));
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
  const cellWidth = estimateCellWidth(options.fontSize);
  const cellHeight = Math.max(12, Math.round(options.fontSize * options.lineHeight));
  const cols = Math.max(options.width, ...lines.map((line) => line.length), 1);
  const rows = Math.max(lines.length, 1);
  const width = options.padding * 2 + cols * cellWidth;
  const height = options.padding * 2 + rows * cellHeight;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = options.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top';

  for (let row = 0; row < rows; row += 1) {
    const line = lines[row] || [];
    for (let col = 0; col < cols; col += 1) {
      const cell = line[col] || { char: ' ', fg: options.fg, bg: null, bold: false };
      const x = options.padding + col * cellWidth;
      const y = options.padding + row * cellHeight;

      if (cell.bg) {
        ctx.fillStyle = cell.bg;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }

      if (cell.char !== ' ') {
        ctx.font = `${cell.bold ? 'bold ' : ''}${options.fontSize}px monospace`;
        ctx.fillStyle = cell.fg;
        ctx.fillText(cell.char, x, y);
      }
    }
  }

  return canvas.toBuffer('image/png');
}
