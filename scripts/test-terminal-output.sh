#!/usr/bin/env bash
set -euo pipefail

echo '== Terminal capability check =='
echo "TERM=${TERM:-}"
echo "COLORTERM=${COLORTERM:-}"

tput colors || true

echo
echo 'Basic colors:'
printf '\033[31mred\033[0m \033[32mgreen\033[0m \033[34mblue\033[0m\n'

echo
echo 'Bold/background:'
printf '\033[1mbold\033[0m \033[41m red-bg \033[0m\n'

echo
echo '256-color row:'
for i in $(seq 16 51); do
  printf '\033[48;5;%sm  \033[0m' "$i"
done
printf '\n\n'

echo 'Truecolor gradient:'
python3 - <<'PY'
for x in range(64):
    r = int(255 * (x / 63))
    g = 100
    b = int(255 * ((63 - x) / 63))
    print(f"\x1b[48;2;{r};{g};{b}m ", end="")
print("\x1b[0m")
PY

echo
echo 'Unicode:'
printf '│ ─ ┌ ┐ └ ┘ 你好 🙂\n'
