#!/usr/bin/env bash
# Builds the website version of Frontlines into site/ (index.html and the art/ folder).
# frontlines.html is written without the document wrapper (the artifact host adds it),
# so this wraps it as a complete page with sharing metadata and an icon.
set -euo pipefail
cd "$(dirname "$0")"

SRC="frontlines.html"
OUT="site/index.html"

mkdir -p site
{
  cat <<'HEAD'
<!doctype html>
<html lang="en">
<head>
<meta name="description" content="Two kingdoms, one river. Draw the roads your armies march on and watch thousands of soldiers clash.">
<meta property="og:title" content="Frontlines">
<meta property="og:description" content="Two kingdoms, one river. Draw the roads your armies march on and watch thousands of soldiers clash.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://frontlines.mkjems.dk/">
<link rel="icon" type="image/png" sizes="32x32" href="art/icon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="art/icon-16.png">
<link rel="apple-touch-icon" href="art/icon-180.png">
HEAD
  # everything up to and including </style> belongs in <head>
  awk '/<\/style>/ { print; exit } { print }' "$SRC"
  echo '</head>'
  echo '<body>'
  awk 'found { print } /<\/style>/ { found = 1 }' "$SRC"
  echo '</body>'
  echo '</html>'
} > "$OUT"
# pictures the page uses: the start screen painting and the icons
rm -rf site/art && cp -R art site/art
echo "Built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
