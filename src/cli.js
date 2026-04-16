#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseAnsi, render } from './lib.js';

function printHelp() {
  console.log(`ansi-to-img\n\nUsage:\n  ansi-to-img [input-file] -o out.png [options]\n\nOptions:\n  -o, --output <file>       Output PNG path\n  --font-size <px>          Font size in pixels (default: 16)\n  --line-height <factor>    Line height multiplier (default: 1.2)\n  --padding <px>            Padding in pixels (default: 16)\n  --bg <color>              Background color (default: #111111)\n  --fg <color>              Default foreground color (default: #dddddd)\n  --width <chars>           Minimum terminal width in character cells\n  -h, --help                Show help\n`);
}

function parseArgs(argv) {
  const options = {
    output: null,
    fontSize: 16,
    lineHeight: 1.2,
    padding: 16,
    bg: '#111111',
    fg: '#dddddd',
    width: 0,
    input: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '-o' || arg === '--output') {
      options.output = argv[++i];
    } else if (arg === '--font-size') {
      options.fontSize = Number(argv[++i]);
    } else if (arg === '--line-height') {
      options.lineHeight = Number(argv[++i]);
    } else if (arg === '--padding') {
      options.padding = Number(argv[++i]);
    } else if (arg === '--bg') {
      options.bg = argv[++i];
    } else if (arg === '--fg') {
      options.fg = argv[++i];
    } else if (arg === '--width') {
      options.width = Number(argv[++i]);
    } else if (!arg.startsWith('-') && !options.input) {
      options.input = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.output) {
    throw new Error('Missing required --output');
  }

  return options;
}

function readInput(inputPath) {
  if (inputPath) {
    return fs.readFileSync(path.resolve(inputPath), 'utf8');
  }

  if (process.stdin.isTTY) {
    throw new Error('No input provided. Pass a file or pipe ANSI text to stdin.');
  }

  return fs.readFileSync(0, 'utf8');
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const input = readInput(options.input);
    const lines = parseAnsi(input, { fg: options.fg });
    const png = render(lines, options);
    fs.mkdirSync(path.dirname(path.resolve(options.output)), { recursive: true });
    fs.writeFileSync(path.resolve(options.output), png);
    console.log(`Wrote ${options.output}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
