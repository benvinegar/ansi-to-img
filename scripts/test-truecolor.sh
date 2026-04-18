#!/usr/bin/env bash
set -euo pipefail

mkdir -p out

echo '== Truecolor ANSI test =='
python3 - <<'PY' | node src/cli.js -o out/test-truecolor.png --padding 12
for y in range(10):
    for x in range(64):
        r = int(255 * (x / 63))
        g = int(255 * (y / 9))
        b = int(255 * ((63 - x) / 63))
        print(f"\x1b[48;2;{r};{g};{b}m ", end="")
    print("\x1b[0m")
PY

echo 'Wrote out/test-truecolor.png'
