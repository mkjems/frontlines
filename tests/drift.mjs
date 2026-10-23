// Do two copies of the same battle stay identical? (docs/multiplayer.md, phases 0 and 1)
// Runs the twins from twins.mjs on every landscape and reports when and where they first differ. `npm test`
// runs a short version; this is the long one.
//
//   npm run drift                  every landscape, 10 game minutes each
//   npm run drift -- valley 120    one landscape, 120 game seconds

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { race } from './twins.mjs';

const LANDS = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'marsh', 'broken'];
const [onlyLand, secsArg] = process.argv.slice(2);
const SECS = +secsArg || 600;
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });
for (const land of onlyLand ? [onlyLand] : LANDS) {
  const r = await race(browser, land, SECS), { a, b } = r.end;
  const counts = `${a.blue}+${a.red} soldiers` + (r.first ? ` vs ${b.blue}+${b.red}` : '');
  console.log(`${land.padEnd(10)} ${r.first ? `differ from second ${r.first.s} (${r.first.parts.join(', ')})` : `identical for ${r.end.s} s`}; ${counts} at the end`
    + (r.errors.length ? `; page errors: ${r.errors.join(' | ')}` : ''));
}
await browser.close();
