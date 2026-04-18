import zlib from "node:zlib";
import { createCanvas } from "canvas";

/** @typedef {import('./types.d.ts').Cell} Cell */
/** @typedef {import('./types.d.ts').Defaults} Defaults */
/** @typedef {import('./types.d.ts').RenderOptions} RenderOptions */

/** @type {Record<number, string>} */
export const ANSI_COLORS = {
  30: "#000000",
  31: "#cd3131",
  32: "#0dbc79",
  33: "#e5e510",
  34: "#2472c8",
  35: "#bc3fbc",
  36: "#11a8cd",
  37: "#e5e5e5",
  40: "#000000",
  41: "#cd3131",
  42: "#0dbc79",
  43: "#e5e510",
  44: "#2472c8",
  45: "#bc3fbc",
  46: "#11a8cd",
  47: "#e5e5e5",
  90: "#666666",
  91: "#f14c4c",
  92: "#23d18b",
  93: "#f5f543",
  94: "#3b8eea",
  95: "#d670d6",
  96: "#29b8db",
  97: "#ffffff",
  100: "#666666",
  101: "#f14c4c",
  102: "#23d18b",
  103: "#f5f543",
  104: "#3b8eea",
  105: "#d670d6",
  106: "#29b8db",
  107: "#ffffff",
};

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 */
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * @param {number} code
 * @returns {string | null}
 */
export function ansi256ToHex(code) {
  if (code < 0 || code > 255 || Number.isNaN(code)) return null;

  if (code < 16) {
    const table = [
      "#000000",
      "#800000",
      "#008000",
      "#808000",
      "#000080",
      "#800080",
      "#008080",
      "#c0c0c0",
      "#808080",
      "#ff0000",
      "#00ff00",
      "#ffff00",
      "#0000ff",
      "#ff00ff",
      "#00ffff",
      "#ffffff",
    ];
    return table[code];
  }

  if (code <= 231) {
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

/**
 * @param {Cell} state
 * @param {string} color
 * @param {38 | 48} target
 */
function applyColor(state, color, target) {
  if (target === 38) state.fg = color;
  else state.bg = color;
}

/**
 * @param {number[]} codes
 * @param {Cell} state
 * @param {Defaults} defaults
 * @returns {Cell}
 */
function applySgrCodes(codes, state, defaults) {
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];

    if (code === 0) {
      state = { fg: defaults.fg, bg: null, bold: false, char: " " };
      continue;
    }

    if (code === 1) {
      state.bold = true;
      continue;
    }

    if (code === 22) {
      state.bold = false;
      continue;
    }

    if (code === 39) {
      state.fg = defaults.fg;
      continue;
    }

    if (code === 49) {
      state.bg = null;
      continue;
    }

    if (code in ANSI_COLORS) {
      applyColor(state, ANSI_COLORS[code], code >= 40 ? 48 : 38);
      continue;
    }

    if (code !== 38 && code !== 48) continue;

    const mode = codes[index + 1];
    if (mode === 5) {
      const color = ansi256ToHex(codes[index + 2]);
      if (color) applyColor(state, color, code);
      index += 2;
      continue;
    }

    if (mode === 2) {
      const r = codes[index + 2];
      const g = codes[index + 3];
      const b = codes[index + 4];
      if (
        [r, g, b].every(
          (value) => Number.isInteger(value) && value >= 0 && value <= 255,
        )
      ) {
        applyColor(state, rgbToHex(r, g, b), code);
      }
      index += 4;
    }
  }

  return state;
}

/**
 * @param {Cell[][]} lines
 * @param {number} targetRow
 * @param {number} targetCol
 * @param {Defaults} defaults
 * @returns {Cell}
 */
function ensureCell(lines, targetRow, targetCol, defaults) {
  while (lines.length <= targetRow) lines.push([]);
  const line = lines[targetRow];
  while (line.length <= targetCol) {
    line.push({ char: " ", fg: defaults.fg, bg: null, bold: false });
  }
  return line[targetCol];
}

/**
 * @param {Cell[][]} lines
 * @param {number} row
 * @param {number} col
 * @param {Cell} state
 * @param {string} char
 * @param {Defaults} defaults
 */
function writeChar(lines, row, col, state, char, defaults) {
  const cell = ensureCell(lines, row, col, defaults);
  cell.char = char;
  cell.fg = state.fg;
  cell.bg = state.bg;
  cell.bold = state.bold;
}

/**
 * @param {string} input
 * @param {number} start
 */
function readEscapeSequence(input, start) {
  let cursor = start + 2;
  let params = "";
  while (cursor < input.length && !/[A-Za-z]/.test(input[cursor])) {
    params += input[cursor];
    cursor += 1;
  }

  return {
    command: input[cursor],
    values: params.split(";").filter(Boolean).map(Number),
    endIndex: cursor,
  };
}

/**
 * @param {string} input
 * @param {Defaults} defaults
 * @returns {Cell[][]}
 */
export function parseAnsi(input, defaults) {
  /** @type {Cell[][]} */
  const lines = [[]];
  let row = 0;
  let col = 0;
  /** @type {Cell} */
  let state = { char: " ", fg: defaults.fg, bg: null, bold: false };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (char === "\u001B" && input[index + 1] === "[") {
      const { command, values, endIndex } = readEscapeSequence(input, index);
      if (command === "m") {
        state = applySgrCodes(
          values.length > 0 ? values : [0],
          state,
          defaults,
        );
      } else if (command === "K") {
        lines[row] = lines[row].slice(0, col);
      } else if (command === "H" || command === "f") {
        row = Math.max(0, (values[0] || 1) - 1);
        col = Math.max(0, (values[1] || 1) - 1);
      }
      index = endIndex;
      continue;
    }

    if (char === "\n") {
      row += 1;
      col = 0;
      while (lines.length <= row) lines.push([]);
      continue;
    }

    if (char === "\r") {
      col = 0;
      continue;
    }

    if (char === "\t") {
      const spaces = 4 - (col % 4 || 4);
      for (let space = 0; space < spaces; space += 1) {
        writeChar(lines, row, col, state, " ", defaults);
        col += 1;
      }
      continue;
    }

    writeChar(lines, row, col, state, char, defaults);
    col += 1;
  }

  return lines;
}

/**
 * @param {string} hex
 */
export function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/**
 * @param {number} width
 * @param {number} height
 * @param {string} bgHex
 */
export function createImageData(width, height, bgHex) {
  const { r, g, b } = hexToRgb(bgHex);
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = 255;
  }
  return data;
}

/**
 * @param {number} fontSize
 */
function estimateCellWidth(fontSize) {
  return Math.max(8, Math.round(fontSize * 0.62));
}

/**
 * @param {Buffer} buffer
 */
function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

/**
 * @param {string} type
 * @param {Buffer} data
 */
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuffer), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/**
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgbaData
 */
export function encodePng(width, height, rgbaData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
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
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * @param {Cell[][]} lines
 * @param {RenderOptions} options
 */
export function render(lines, options) {
  const cellWidth = estimateCellWidth(options.fontSize);
  const cellHeight = Math.max(
    12,
    Math.round(options.fontSize * options.lineHeight),
  );
  const cols = Math.max(options.width, ...lines.map((line) => line.length), 1);
  const rows = Math.max(lines.length, 1);
  const width = options.padding * 2 + cols * cellWidth;
  const height = options.padding * 2 + rows * cellHeight;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = options.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";

  for (let row = 0; row < rows; row += 1) {
    const line = lines[row] || [];
    for (let col = 0; col < cols; col += 1) {
      const cell = line[col] || {
        char: " ",
        fg: options.fg,
        bg: null,
        bold: false,
      };
      const x = options.padding + col * cellWidth;
      const y = options.padding + row * cellHeight;

      if (cell.bg) {
        ctx.fillStyle = cell.bg;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }

      if (cell.char !== " ") {
        ctx.font = `${cell.bold ? "bold " : ""}${options.fontSize}px monospace`;
        ctx.fillStyle = cell.fg;
        ctx.fillText(cell.char, x, y);
      }
    }
  }

  return canvas.toBuffer("image/png");
}
