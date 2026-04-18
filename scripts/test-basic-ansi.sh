#!/usr/bin/env bash
set -euo pipefail

mkdir -p out

echo '== Basic ANSI test =='
printf '\033[31mred\033[0m\n\033[32mgreen\033[0m\n\033[34mblue\033[0m\n' | node src/cli.js -o out/test-basic-ansi.png

echo 'Wrote out/test-basic-ansi.png'
