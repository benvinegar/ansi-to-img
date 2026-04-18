# ansi-to-img

Convert ANSI terminal output into PNG images from the command line.

A small Node CLI for turning terminal output with ANSI escape sequences into shareable screenshots.

## CLI design

```bash
ansi-to-img [input-file] -o out.png
```

If no input file is provided, the command reads ANSI text from stdin.

### Input format

The recommended input is raw terminal output containing ANSI escape sequences.

Examples:

```bash
printf '\x1b[31mred\x1b[0m\n' | ansi-to-img -o out.png
my-program | ansi-to-img -o output.png
ansi-to-img session.ansi -o output.png
```

### Options

- `-o, --output <file>`: output PNG path
- `--font-size <px>`: font size in pixels, default `16`
- `--line-height <factor>`: line height multiplier, default `1.2`
- `--padding <px>`: padding around content, default `16`
- `--bg <css-color>`: background color, default `#111111`
- `--fg <css-color>`: default foreground color, default `#dddddd`
- `--width <chars>`: minimum terminal width in character cells

## Notes

Current MVP supports:
- standard SGR colors (`30-37`, `90-97`, `40-47`, `100-107`)
- 256-color ANSI (`38;5;<n>` / `48;5;<n>`)
- truecolor ANSI (`38;2;<r>;<g>;<b>` / `48;2;<r>;<g>;<b>`)
- reset/bold styles
- newline/carriage return
- real font rendering through `canvas`
- Unicode text rendering, including box drawing and other non-ASCII glyphs when supported by installed fonts

It renders the final terminal state to a PNG image.

## Manual test scripts

These scripts are useful when testing over SSH or validating terminal/color support manually.

```bash
npm run test:terminal   # print ANSI/Unicode directly to your terminal
npm run test:basic      # generate a basic ANSI PNG
npm run test:256        # generate a 256-color PNG
npm run test:truecolor  # generate a truecolor PNG
npm run test:unicode    # generate a Unicode PNG
npm run test:manual     # run all manual scripts
```

Generated files are written to `out/`.

## Development

```bash
npm install
npm run format
npm run lint
npm run typecheck
npm test
```

## License

MIT
