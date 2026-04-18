#!/usr/bin/env bash
set -euo pipefail

./scripts/test-terminal-output.sh
./scripts/test-basic-ansi.sh
./scripts/test-256color.sh
./scripts/test-truecolor.sh
./scripts/test-unicode.sh

echo
echo 'All test images written to ./out'
ls -1 out | sed 's/^/ - /'
