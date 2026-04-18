import { describe, expect, test } from "vitest";
import zlib from "node:zlib";
import {
  ansi256ToHex,
  createImageData,
  encodePng,
  hexToRgb,
  parseAnsi,
  render,
} from "../src/lib.ts";

function parsePng(buffer: Buffer): {
  width: number;
  height: number;
  rgba: Buffer;
} {
  expect(buffer.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  let offset = 8;
  let width = 0;
  let height = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === "IDAT") {
      idatChunks.push(data);
    }
    if (type === "IEND") {
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

function pixelAt(
  image: { width: number; rgba: Buffer },
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const idx = (y * image.width + x) * 4;
  return {
    r: image.rgba[idx]!,
    g: image.rgba[idx + 1]!,
    b: image.rgba[idx + 2]!,
    a: image.rgba[idx + 3]!,
  };
}

function hasPixel(
  image: { width: number; height: number; rgba: Buffer },
  predicate: (pixel: { r: number; g: number; b: number; a: number }) => boolean,
): boolean {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (predicate(pixelAt(image, x, y))) return true;
    }
  }
  return false;
}

describe("parseAnsi", () => {
  test("parses plain text into cells", () => {
    const lines = parseAnsi("abc", { fg: "#dddddd" });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.map((cell) => cell.char).join("")).toBe("abc");
  });

  test("applies foreground color and reset", () => {
    const lines = parseAnsi("\u001B[31mr\u001B[0mx", { fg: "#dddddd" });
    expect(lines[0]![0]).toMatchObject({ char: "r", fg: "#cd3131" });
    expect(lines[0]![1]).toMatchObject({ char: "x", fg: "#dddddd" });
  });

  test("applies background color and bold", () => {
    const lines = parseAnsi("\u001B[44;1mA", { fg: "#dddddd" });
    expect(lines[0]![0]).toMatchObject({
      char: "A",
      bg: "#2472c8",
      bold: true,
    });
  });

  test("supports 256-color foreground/background", () => {
    const lines = parseAnsi("\u001B[38;5;208;48;5;17mX", { fg: "#dddddd" });
    expect(lines[0]![0]).toMatchObject({
      char: "X",
      fg: "#ff8700",
      bg: "#00005f",
    });
  });

  test("supports truecolor foreground/background", () => {
    const lines = parseAnsi("\u001B[38;2;12;34;56;48;2;200;210;220mY", {
      fg: "#dddddd",
    });
    expect(lines[0]![0]).toMatchObject({
      char: "Y",
      fg: "#0c2238",
      bg: "#c8d2dc",
    });
  });

  test("handles cursor positioning", () => {
    const lines = parseAnsi("ab\u001B[2;3Hc", { fg: "#dddddd" });
    expect(lines[0]!.map((cell) => cell.char).join("")).toBe("ab");
    expect(lines[1]![2]).toMatchObject({ char: "c" });
  });

  test("handles erase to end of line", () => {
    const lines = parseAnsi("abcd\rxy\u001B[K", { fg: "#dddddd" });
    expect(lines[0]!.map((cell) => cell.char).join("")).toBe("xy");
  });
});

describe("png helpers", () => {
  test("hexToRgb converts hex colors", () => {
    expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
    expect(hexToRgb("#123456")).toEqual({ r: 18, g: 52, b: 86 });
  });

  test("ansi256ToHex converts xterm 256-color codes", () => {
    expect(ansi256ToHex(16)).toBe("#000000");
    expect(ansi256ToHex(208)).toBe("#ff8700");
    expect(ansi256ToHex(244)).toBe("#808080");
  });

  test("createImageData fills background", () => {
    const data = createImageData(2, 1, "#112233");
    expect([...data]).toEqual([17, 34, 51, 255, 17, 34, 51, 255]);
  });

  test("encodePng writes valid dimensions", () => {
    const png = encodePng(2, 3, createImageData(2, 3, "#000000"));
    const image = parsePng(png);
    expect(image.width).toBe(2);
    expect(image.height).toBe(3);
  });
});

describe("render", () => {
  test("renders background and text into a PNG", () => {
    const lines = parseAnsi("\u001B[41mA", { fg: "#dddddd" });
    const png = render(lines, {
      fontSize: 16,
      lineHeight: 1.2,
      padding: 4,
      bg: "#111111",
      fg: "#dddddd",
      width: 0,
    });

    const image = parsePng(png);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
    expect(pixelAt(image, 0, 0)).toMatchObject({ r: 17, g: 17, b: 17, a: 255 });
    expect(hasPixel(image, (pixel) => pixel.a === 255)).toBe(true);
    expect(
      hasPixel(
        image,
        (pixel) => !(pixel.r === 17 && pixel.g === 17 && pixel.b === 17),
      ),
    ).toBe(true);
  });

  test("respects minimum width option", () => {
    const lines = parseAnsi("A", { fg: "#dddddd" });
    const png = render(lines, {
      fontSize: 16,
      lineHeight: 1.2,
      padding: 4,
      bg: "#111111",
      fg: "#dddddd",
      width: 10,
    });

    const image = parsePng(png);
    expect(image.width).toBe(4 * 2 + 10 * Math.max(8, Math.round(16 * 0.62)));
  });

  test("renders unicode glyphs into non-background pixels", () => {
    const lines = parseAnsi("│你好🙂", { fg: "#dddddd" });
    const png = render(lines, {
      fontSize: 18,
      lineHeight: 1.2,
      padding: 4,
      bg: "#111111",
      fg: "#dddddd",
      width: 0,
    });

    const image = parsePng(png);
    expect(
      hasPixel(
        image,
        (pixel) => !(pixel.r === 17 && pixel.g === 17 && pixel.b === 17),
      ),
    ).toBe(true);
  });
});
