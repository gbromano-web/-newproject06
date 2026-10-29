#!/bin/sh
# Pre-deploy gate: fails the build if launch placeholders are still present.
# Staging/preview deploys can bypass with ALLOW_PLACEHOLDERS=1 (set in the host's env settings).
set -eu
cd "$(dirname "$0")/../public"

PATTERN='ca-pub-XXXXXXXXXXXXXXXX|pub-XXXXXXXXXXXXXXXX|REPLACE-WITH-REAL-PROFILE|\[Registered business address\]|\[City, Country\]|\[your jurisdiction\]'
HITS=$(grep -RInE "$PATTERN" --include='*.html' --include='*.js' --include='*.txt' . || true)

# Every page must link the privacy policy, and ads.txt must exist (AdSense requirements)
MISSING=""
for f in index.html article-template.html about.html contact.html privacy.html terms.html 404.html; do
  [ -f "$f" ] || { MISSING="$MISSING\n  missing file: $f"; continue; }
  grep -q 'href="/privacy.html"' "$f" || MISSING="$MISSING\n  no privacy link: $f"
done
[ -f ads.txt ] || MISSING="$MISSING\n  missing ads.txt"

if [ -n "$MISSING" ]; then printf "PREFLIGHT FAILED — structural problems:%b\n" "$MISSING"; exit 1; fi

if [ -n "$HITS" ]; then
  if [ "${ALLOW_PLACEHOLDERS:-0}" = "1" ]; then
    echo "PREFLIGHT WARNING — placeholders present (allowed for this preview deploy):"; echo "$HITS"; exit 0
  fi
  echo "PREFLIGHT FAILED — replace these placeholders before a production deploy:"; echo "$HITS"; exit 1
fi
echo "PREFLIGHT OK"
