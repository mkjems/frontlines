// Browser tests for Frontlines. They open the built game (site/index.html?test) in headless Chrome
// and play it with real mouse and touch input. The ?test URL flag exposes a small hook, window.__t,
// for finding towns on screen, fast-forwarding time and staging fights (see the end of frontlines.html).
//
// Run from this folder:  npm install && npm test
// Chrome is found automatically on macOS and Linux; set CHROME_PATH to use another browser binary.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const GAME = new URL('../site/index.html?test', import.meta.url).href;
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser;

before(async () => {
  assert.ok(CHROME, 'Chrome not found: set CHROME_PATH');
  assert.ok(existsSync(fileURLToPath(new URL('../site/index.html', import.meta.url))), 'site/index.html missing: run ../build.sh');
  // SwiftShader gives headless Chrome WebGL on machines without a GPU (such as CI runners)
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });
});
after(async () => { await browser?.close(); });

// Opens the game and starts a campaign; collects page errors so each test can assert there were none.
async function openGame(viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(GAME);
  await page.waitForFunction(() => window.__t, { timeout: 20000 });
  await sleep(500);
  return page;
}
const t = (page, fn, ...args) => page.evaluate((fn, args) => window.__t[fn](...args), fn, args);
async function dragTo(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 25; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 25, a.y + (b.y - a.y) * i / 25); await sleep(16); }
}

test('intro: tip carousel and how-to-win fold-out', async () => {
  const page = await openGame();
  const active = () => page.evaluate(() => [...document.querySelectorAll('#carousel .slide')].findIndex(s => s.classList.contains('on')));
  assert.equal(await active(), 0, 'the first tip shows');
  await page.click('#tipNext');
  assert.equal(await active(), 1, 'the next arrow moves on');
  await page.click('#tipPrev'); await page.click('#tipPrev');
  assert.equal(await active(), 6, 'going back from the first tip wraps to the last');
  const shown = () => page.evaluate(() => !document.getElementById('diffTips').hidden);
  const before = await shown();
  await page.click('#showTips');
  assert.equal(await shown(), !before, 'the checkbox folds the how-to-win box in and out');
  await page.click('#diff-hard');
  assert.match(await page.evaluate(() => document.getElementById('foldLabel').textContent), /Hard/, 'the label follows the difficulty');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('drawing routes', async () => {
  const page = await openGame();
  await t(page, 'start');
  await dragTo(page, await t(page, 'pos', 'Brindle'), await t(page, 'pos', 'Millbrook'));
  await page.mouse.up();
  await sleep(100);
  assert.equal(await t(page, 'route', 'Brindle'), 'Millbrook', 'a route dragged onto a town targets it');

  // released beside the town rather than on its centre: the route still locks onto it
  await dragTo(page, await t(page, 'pos', 'Coldwater'), await t(page, 'pos', 'Oakhollow', -24, -16));
  await page.mouse.up();
  await sleep(100);
  assert.equal(await t(page, 'route', 'Coldwater'), 'Oakhollow', 'a route released near a town locks onto it');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('an army sent into the enemy capital takes it', async () => {
  // Regression: a route released inside Redmarsh's city wall but away from the keep used to end on open
  // ground, so the army camped inside the walls and the capital could never fall.
  const page = await openGame();
  await t(page, 'start');
  const camp = await t(page, 'army', 'Redmarsh', 120, 110);
  const inside = await t(page, 'pos', 'Redmarsh', 0, 50);   // within the wall, well off the keep
  await dragTo(page, camp, inside);
  await page.mouse.up();
  await sleep(100);
  for (let i = 0; i < 12 && await t(page, 'state') === 'play'; i++) await t(page, 'run', 5);
  assert.equal(await t(page, 'owner', 'Redmarsh'), 0, 'Redmarsh falls to the army');
  assert.equal(await t(page, 'state'), 'over', 'taking the capital ends the game');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('camera zoom and pan', async () => {
  const page = await openGame();
  await t(page, 'start');
  const before = await t(page, 'pos', 'Millbrook');
  await page.mouse.move(before.x, before.y);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: -120 }); await sleep(30); }
  const zoomed = await t(page, 'view');
  assert.ok(zoomed.z > 2, `the wheel zooms in (zoom ${zoomed.z.toFixed(2)})`);
  const after = await t(page, 'pos', 'Millbrook');
  const drift = Math.hypot(after.x - before.x, after.y - before.y);
  assert.ok(drift < 5, `zooming keeps the point under the cursor (drifted ${drift.toFixed(1)}px)`);

  await page.mouse.move(800, 500);
  await page.mouse.down();
  await page.mouse.move(700, 450, { steps: 10 });
  await page.mouse.up();
  const panned = await t(page, 'view');
  assert.ok(Math.hypot(panned.x - zoomed.x, panned.y - zoomed.y) > 5, 'dragging open ground pans the view');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('placing a watchtower', async () => {
  const page = await openGame();
  await t(page, 'start');
  await page.click('#tray-tower');
  const spot = await t(page, 'pos', 'Ashford', 70, 40);   // always valid: own side, clear of the town
  await page.mouse.move(spot.x, spot.y);
  await sleep(100);
  await page.mouse.click(spot.x, spot.y);
  await sleep(100);
  assert.equal(await t(page, 'buildings'), 1, 'clicking the map with a watchtower armed builds it');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('battles, captures and attacks on your capital', async () => {
  const page = await openGame();
  await t(page, 'start');
  await t(page, 'melee');
  await t(page, 'run', 3);
  const alive = await t(page, 'alive');
  assert.ok(alive < 80, `soldiers fight and die (${alive} of 80 left)`);

  assert.equal(await t(page, 'capture', 'Larkspur', 0), 0);
  await sleep(300);
  assert.ok((await t(page, 'smouldering')).includes('Larkspur'), 'a captured town smoulders');

  const hit = await t(page, 'hitCapital');
  assert.ok(hit.hold < hit.before, 'an enemy reaching your capital weakens its hold');
  assert.equal(hit.shake, 0, 'attacks on your capital do not shake the camera');
  assert.equal(await t(page, 'capture', 'Brindle', 1), 1, 'losing a town works');
  assert.ok(await t(page, 'shake') > 0, 'losing a town shakes the camera');

  await t(page, 'run', 40);
  await sleep(300);
  assert.deepEqual(page.errors, [], 'a long stretch of play runs without errors');
  await page.close();
});

test('phone layout with touch', async () => {
  const page = await openGame({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.tap('#startBtn');
  await sleep(500);
  const board = await t(page, 'pos', 'Ashford');
  assert.ok(board.x > 0 && board.x < 390 && board.y > 0 && board.y < 844, 'the board fits on a phone screen');
  assert.deepEqual(page.errors, []);
  await page.close();
});
