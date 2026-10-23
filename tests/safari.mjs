// Chrome against Safari: does the same battle come out the same in both browsers? (docs/multiplayer.md)
// The twins from twins.mjs, with one copy in Chrome and the other in real Safari, controlled through
// safaridriver. Safari's engine is the one on every iPhone, so this is the cross-browser case that matters most.
// macOS only, and Safari's automation must be switched on once: `sudo safaridriver --enable`, then in Safari's
// settings tick "Show features for web developers" and, under Developer, "Allow remote automation".
//
//   npm run safari                  every landscape, 10 game minutes each
//   npm run safari -- valley 120    one landscape, 120 game seconds

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { MAP, BOARD, MATCH, ORDERS, setupInPage, secondInPage, differ, chromeCopy, chromeSecond } from './twins.mjs';

const LANDS = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'marsh', 'broken'];
const [onlyLand, secsArg] = process.argv.slice(2);
const SECS = +secsArg || 600;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) throw new Error('Chrome not found: set CHROME_PATH');

// Safari won't open file:// pages under automation, so both browsers load the built site over http
const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try { const body = await readFile(join(SITE, path.endsWith('/') ? path + 'index.html' : path)); res.writeHead(200, { 'content-type': TYPES[extname(path) || '.html'] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?test`;

// safaridriver speaks WebDriver over http
const DRIVER_PORT = 4567;
const driver = spawn('safaridriver', ['-p', String(DRIVER_PORT)], { stdio: 'inherit' });
const wd = async (method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${DRIVER_PORT}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const json = await r.json();
  if (json.value?.error) throw new Error(`safaridriver: ${json.value.error}: ${json.value.message}`);
  return json.value;
};
for (let i = 0; ; i++) {
  try { await wd('GET', '/status'); break; } catch (e) { if (i > 50) throw e; await new Promise(r => setTimeout(r, 100)); }
}
const session = (await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })).sessionId;
const S = `/session/${session}`;
// run one of twins.mjs's in-page functions in Safari
const inSafari = (fn, ...args) => wd('POST', `${S}/execute/sync`, { script: `return (${fn})(...arguments)`, args });
await wd('POST', `${S}/window/rect`, { width: 900, height: 700 });   // Safari's own window size: different from Chrome's on purpose

async function safariCopy(land) {
  await wd('POST', `${S}/url`, { url: URL_ });
  for (let i = 0; !(await inSafari(() => !!window.__t)); i++) { if (i > 100) throw new Error('the game did not load in Safari'); await new Promise(r => setTimeout(r, 100)); }
  await inSafari(setupInPage, land, MAP, BOARD, MATCH, false);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  for (const land of onlyLand ? [onlyLand] : LANDS) {
    const chrome = await chromeCopy(browser, land, URL_);
    await safariCopy(land);
    let first = null, end = null;
    for (let s = 0; s < SECS; s++) {
      const [rc, rs] = await Promise.all([chromeSecond(chrome, s), inSafari(secondInPage, ORDERS[s] || 0)]);
      const diff = differ(rc, rs);
      if (diff.length && !first) first = { s: s + 1, parts: diff };
      end = { s: s + 1, c: rc, sf: rs };
    }
    const errors = chrome.errors;
    await chrome.browserContext().close();
    const counts = `${end.c.blue}+${end.c.red} soldiers in Chrome` + (first ? `, ${end.sf.blue}+${end.sf.red} in Safari` : '');
    console.log(`${land.padEnd(10)} ${first ? `differ from second ${first.s} (${first.parts.join(', ')})` : `identical for ${end.s} s`}; ${counts} at the end`
      + (errors.length ? `; Chrome page errors: ${errors.join(' | ')}` : ''));
  }
} finally {
  await browser.close();
  await wd('DELETE', S).catch(() => {});
  driver.kill(); server.close();
}
