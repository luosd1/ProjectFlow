#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-"$ROOT/dist/waza.zip"}"
case "$OUT" in
  /*) ;;
  *) OUT="$ROOT/$OUT" ;;
esac

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"

cd "$ROOT"

MANIFEST="$(mktemp)"
FILTERED_MANIFEST="$(mktemp)"
STAGE="$(mktemp -d)"
trap 'rm -f "$MANIFEST" "$FILTERED_MANIFEST"; rm -rf "$STAGE"' EXIT

git ls-files --cached --others --exclude-standard > "$MANIFEST"

awk '
  /^\.claude-plugin\// { next }
  /^\.claude\// { next }
  /^\.github\// { next }
  /^dist\// { next }
  /^Makefile$/ { next }
  /^skills-lock\.json$/ { next }
  /^scripts\/verify-skills\.sh$/ { next }
  /^scripts\/statusline\.sh$/ { next }
  /^scripts\/setup-statusline\.sh$/ { next }
  /^scripts\/package-skill\.sh$/ { next }
  /^skills\/[^\/]+\/SKILL\.md$/ { next }
  /(^|\/)__pycache__\// { next }
  /\.pyc$/ { next }
  /(^|\/)\.DS_Store$/ { next }
  { print }
' "$MANIFEST" > "$FILTERED_MANIFEST"

tar -cf - -T "$FILTERED_MANIFEST" | (cd "$STAGE" && tar -xf -)

find skills -mindepth 2 -maxdepth 2 -name SKILL.md | sort | while IFS= read -r path; do
  skill="$(basename "$(dirname "$path")")"
  {
    printf '\n---\n\n# SKILL: %s\n\n' "$skill"
    awk 'BEGIN{skip=0} /^---$/{if(NR==1){skip=1;next} if(skip){skip=0;next}} !skip' "$path"
  } >> "$STAGE/SKILL.md"
done

perl -0pi -e 's#`skills/([a-z][a-z0-9_-]*)/SKILL\.md`#the **$1** section below#g' "$STAGE/SKILL.md"
find "$STAGE/skills" -type d -empty -delete 2>/dev/null || true

(cd "$STAGE" && find . -type f | sed 's#^\./##' | sort | zip -q "$OUT" -@)

if ! zipinfo -1 "$OUT" | awk '$0 == "SKILL.md" { found = 1 } END { exit found ? 0 : 1 }'; then
  echo "ERROR: root SKILL.md missing from $OUT" >&2
  exit 1
fi

SKILL_COUNT="$(zipinfo -1 "$OUT" | awk '$0 ~ /(^|\/)SKILL\.md$/ { count++ } END { print count + 0 }')"
if [ "$SKILL_COUNT" -ne 1 ]; then
  echo "ERROR: expected exactly one SKILL.md in $OUT, found $SKILL_COUNT" >&2
  exit 1
fi

SIZE=$(wc -c < "$OUT" | tr -d ' ')
echo "OK: wrote $OUT (${SIZE} bytes)"
