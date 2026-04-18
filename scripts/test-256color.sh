#!/usr/bin/env bash
set -euo pipefail

mkdir -p out

echo '== 256-color ANSI test =='
{
  for i in $(seq 0 255); do
    printf '\033[48;5;%sm  \033[0m' "$i"
    if [ $(( (i + 1) % 16 )) -eq 0 ]; then
      printf '\n'
    fi
  done
} | node src/cli.js -o out/test-256color.png --padding 12

echo 'Wrote out/test-256color.png'
