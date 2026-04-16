# ansi-to-img

Convert ANSI terminal output into an image from the command line.

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
- SGR colors (`30-37`, `90-97`, `40-47`, `100-107`)
- reset/bold styles
- newline/carriage return

It renders the final terminal state to a PNG image.
