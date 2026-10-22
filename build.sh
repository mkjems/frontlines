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
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23e8ebe2'/%3E%3Cpath d='M17 0 C13 10 19 22 15 32' stroke='%23a9cfe2' stroke-width='6' fill='none'/%3E%3Crect x='3' y='12' width='9' height='9' rx='2' fill='%233b6fd4'/%3E%3Crect x='20' y='12' width='9' height='9' rx='2' fill='%23df5448'/%3E%3C/svg%3E">
HEAD
  # everything up to and including </style> belongs in <head>
  awk '/<\/style>/ { print; exit } { print }' "$SRC"
  echo '</head>'
  echo '<body>'
  awk 'found { print } /<\/style>/ { found = 1 }' "$SRC"
  echo '</body>'
  echo '</html>'
} > "$OUT"
# pictures the page uses (the start screen painting)
rm -rf site/art && cp -R art site/art
echo "Built $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
