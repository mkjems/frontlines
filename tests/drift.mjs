// Phase 0 of docs/multiplayer.md: how far is the game from deterministic?
// Runs two copies of the same battle side by side in headless Chrome, steps both by hand one game second at a
// time with the same orders, and reports when and where their states first differ. Not part of `npm test`:
// it reports, it doesn't pass or fail.
//
//   npm run drift                  every landscape, 10 game minutes each
//   npm run drift -- valley 120    one landscape, 120 game seconds
//
// Two modes per landscape:
//   as is:   the game as it is today (battles use Math.random)
//   seeded:  Math.random replaced by the same seeded generator in both copies, and drawing stopped, so the
//            only differences left are ones the simulation itself brings in (time, frame rate, order of things)

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const LANDS = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'marsh', 'broken'];
const [onlyLand, secsArg] = process.argv.slice(2);
const SECS = +secsArg || 600, MAP = 4821;
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
const URL_ = new URL('../site/index.html?test', import.meta.url).href;
// the same blue orders in both copies: armies from the capital towards the enemy's at these game seconds
const ORDERS = { 5: 20, 60: 30, 150: 40, 300: 40, 450: 50 };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });

async function copy(land, seeded) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__t);
  await page.evaluate((land, map, seeded) => {
    if (seeded) {
      window.requestAnimationFrame = () => 0;   // no more drawing (it uses Math.random too)
      let x = 99;   // mulberry32, the same generator the game uses for maps
      Math.random = () => { x = (x + 0x6d2b79f5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    __t.freeze(); __t.newMap(land, map); __t.start();
  }, land, MAP, seeded);
  return page;
}

async function second(page, s) {
  return page.evaluate((s, n) => {
    if (n) __t.march('Ashford', 'Redmarsh', n);
    __t.run(1);
    if (__t.state() === 'upgrade') document.getElementById('choice0').click();
    return { snap: __t.snapshot(), state: __t.state(), choice: document.getElementById('choices').textContent };
  }, s, ORDERS[s] || 0);
}

async function race(land, seeded) {
  const a = await copy(land, seeded), b = await copy(land, seeded);
  let first = null, over = null, s = 0;   // a battle plays on behind the end dialog, so a lost game keeps going
  for (; s < SECS; s++) {
    const [ra, rb] = await Promise.all([second(a, s), second(b, s)]);
    const diff = Object.keys(ra.snap.parts).filter(k => ra.snap.parts[k] !== rb.snap.parts[k]);
    if (ra.choice !== rb.choice && !diff.includes('weekly choice')) diff.push('weekly choice');
    if (diff.length && !first) first = { s: s + 1, parts: diff };
    if (s === SECS - 1) over = { s: SECS, a: ra.snap, b: rb.snap };
  }
  const errors = [...a.errors, ...b.errors];
  await a.close(); await b.close();
  return { first, end: over, errors };
}

const fmt = r => {
  const end = `after ${r.end.s} s: ${r.end.a.blue}+${r.end.a.red} soldiers vs ${r.end.b.blue}+${r.end.b.red}`;
  return (r.first ? `differ from second ${r.first.s} (${r.first.parts.join(', ')}); ${end}` : `identical for ${r.end.s} s (${r.end.a.blue}+${r.end.a.red} soldiers at the end)`)
    + (r.errors.length ? `; page errors: ${r.errors.join(' | ')}` : '');
};

for (const land of onlyLand ? [onlyLand] : LANDS) {
  console.log(`${land}`);
  console.log(`  as is:   ${fmt(await race(land, false))}`);
  console.log(`  seeded:  ${fmt(await race(land, true))}`);
}
await browser.close();
