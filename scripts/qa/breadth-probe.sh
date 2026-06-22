#!/usr/bin/env bash
# Probe one image against prod /api/extract (tip path). Prints a one-line verdict.
img="$1"
name=$(basename "$img")
out="/home/dom/tta-matrix/qa-artifacts/breadth/${name}.sse"
code=$(curl -s -o "$out" -w "%{http_code}" --max-time 100 \
  -X POST https://tta-pete-demo.pages.dev/api/extract \
  -H "Origin: https://tta-pete-demo.pages.dev" \
  -F "image=@${img}")
ok="NO"; grep -q '"type":"extraction"' "$out" 2>/dev/null && ok="YES"
err=$(grep -o '"type":"error"[^}]*}' "$out" 2>/dev/null | head -c 100)
meeting=$(grep -o '"meeting":"[^"]*"' "$out" 2>/dev/null | head -1)
races=$(grep -o '"raceNumber"' "$out" 2>/dev/null | wc -l | tr -d ' ')
printf '[%s] extraction=%-3s races=%-3s %-28s %s :: %s\n' "$code" "$ok" "$races" "${meeting}" "${err:+ERR:$err}" "$name"
