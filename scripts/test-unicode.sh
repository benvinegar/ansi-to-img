#!/usr/bin/env bash
set -euo pipefail

mkdir -p out

echo '== Unicode rendering test =='
printf 'Box: │ ─ ┌ ┐ └ ┘\nCJK: 你好 世界\nEmoji: 🙂 🚀 ✨\nMath: ≤ ≥ ≠ π\n' | node src/cli.js -o out/test-unicode.png --font-size 20

echo 'Wrote out/test-unicode.png'
