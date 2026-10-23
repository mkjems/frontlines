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

// the tests run on the classic town layout, whose towns have known names and places
const GAME = new URL('../site/index.html?test&land=valley&layout=classic', import.meta.url).href;
const RANDOM = new URL('../site/index.html?test', import.meta.url).href;
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
async function openGame(viewport = { width: 1440, height: 900 }, url = GAME) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__t, { timeout: 20000 });
  await sleep(500);
  return page;
}
const t = (page, fn, ...args) => page.evaluate((fn, args) => window.__t[fn](...args), fn, args);
// through the start screen's steps to the last one, where Start campaign is
async function toStart(page) {
  if (await page.$eval('#intro', e => e.dataset.step === '1')) await page.click('#step1 [data-go="2"]');
  if (await page.$eval('#intro', e => e.dataset.step === '2')) await page.click('#step2 [data-go="3"]');
}
async function dragTo(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 25; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 25, a.y + (b.y - a.y) * i / 25); await sleep(16); }
}

test('start screen: welcome and tips, then the map, then the difficulty', async () => {
  const page = await openGame();
  await page.evaluate(() => localStorage.removeItem('frontlines-seen-intro'));
  await page.reload(); await page.waitForFunction(() => window.__t, { timeout: 20000 });
  const step = () => page.$eval('#intro', e => +e.dataset.step);
  assert.equal(await step(), 1, 'a first visit opens on the welcome');
  const active = () => page.evaluate(() => [...document.querySelectorAll('#carousel .slide')].findIndex(s => s.classList.contains('on')));
  // The carousel advances by itself every 7s until touched, and on slow machines (CI renders WebGL in
  // software) the first advance can happen before we look, so start by clicking the first dot.
  await page.click('#tipDots button:first-child');
  assert.equal(await active(), 0, 'a dot jumps to its tip');
  await page.click('#tipNext');
  assert.equal(await active(), 1, 'the next arrow moves on');
  await page.click('#tipPrev'); await page.click('#tipPrev');
  assert.equal(await active(), 6, 'going back from the first tip wraps to the last');
  await page.click('#step1 [data-go="2"]');
  assert.equal(await step(), 2, 'Choose a map moves on to the map');
  assert.ok(await page.$eval('#step1', e => e.hidden) && !(await page.$eval('#step2', e => e.hidden)), 'one card at a time');
  const land = await t(page, 'land');
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await t(page, 'land'), land, 'the arrow keys step through the landscapes on the map step');
  await page.click('#step2 [data-go="3"]');
  assert.equal(await step(), 3, 'Next moves on to the difficulty');
  await page.click('#diff-hard');
  assert.match(await page.$eval('#tipsTitle', e => e.textContent), /Hard/, 'the how-to-win tips follow the difficulty, shown straight away');
  await page.click('#step3 [data-go="2"]');
  assert.equal(await step(), 2, 'Back goes back');
  await page.reload(); await page.waitForFunction(() => window.__t, { timeout: 20000 });
  assert.equal(await step(), 2, 'a returning player starts on the map');
  await toStart(page);
  await page.click('#startBtn');
  assert.equal(await t(page, 'state'), 'play', 'Start campaign starts');
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
  // the battle plays on behind the end dialog, and Keep watching tucks the dialog away
  const before = await t(page, 'alive');
  await t(page, 'run', 5);
  assert.notEqual(await t(page, 'alive'), before, 'soldiers keep training and fighting after the war is decided');
  await page.click('#watchBtn');
  assert.ok(await page.$eval('#over', e => e.hidden) && !(await page.$eval('#watchBar', e => e.hidden)), 'the dialog gives way to a small bar');
  await page.click('#againBtn2');
  assert.equal(await t(page, 'state'), 'intro', 'Play again starts over');
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

test('Broken Bridges: no way across until each side builds its free bridge', async () => {
  const page = await openGame();
  await t(page, 'newMap', 'broken', 21);
  await t(page, 'start');
  assert.equal((await t(page, 'terrain')).crossings, 0, 'the river starts with no crossings');
  assert.deepEqual(await t(page, 'bridgesLeft'), { blue: 1, red: 1 }, 'both sides have a bridge to build');
  await page.click('#tray-bridge');
  const spot = await t(page, 'riverPoint', 0.5);
  await page.mouse.move(spot.x, spot.y); await sleep(100);
  await page.mouse.click(spot.x, spot.y); await sleep(100);
  assert.equal((await t(page, 'terrain')).crossings, 1, 'clicking the river with the bridge armed builds it');
  assert.equal((await t(page, 'bridgesLeft')).blue, 0, 'and uses up the free bridge');
  await t(page, 'run', 40);
  assert.equal((await t(page, 'terrain')).crossings, 2, 'the enemy builds its own bridge');
  assert.equal((await t(page, 'bridgesLeft')).red, 0);
  assert.ok(await t(page, 'dry'), 'nobody ends up in the water');
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

test('every landscape builds and plays: towns stay dry and nobody walks through crags', async () => {
  const page = await openGame();
  for (const k of ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'marsh', 'broken']) {
    assert.equal(await t(page, 'newMap', k), k);
    assert.equal(await page.$eval('#landName', e => e.textContent.length > 0), true, 'the intro names the landscape');
    await t(page, 'start'); await t(page, 'run', 40);
    assert.ok(await t(page, 'dry'), `${k}: no town or soldier is in the water`);
    assert.equal(await t(page, 'onCrag'), 0, `${k}: nobody stands inside a crag`);
    assert.ok(await t(page, 'alive') > 20, `${k}: both kingdoms field armies`);
  }
  const terrain = await t(page, 'newMap', 'highlands') && await t(page, 'terrain');
  assert.ok(terrain.crags > 0, 'the highlands have crags');
  assert.ok((await t(page, 'newMap', 'marsh'), await t(page, 'terrain')).marshes > 0, 'the marshes have bogs');
  // the arrows step through every landscape once, in order, then starts over
  const seen = [];
  for (let i = 0; i < 10; i++) { await page.evaluate(() => document.getElementById('landNext').click()); seen.push(await t(page, 'land')); }
  assert.equal(new Set(seen).size, 10, 'ten presses visit all ten landscapes');
  assert.equal(seen[9], 'marsh', 'and the tenth comes back round to where it started');
  await page.evaluate(() => document.getElementById('landPrev').click());
  assert.equal(await t(page, 'land'), 'highlands', 'the back arrow goes the other way');
  await page.evaluate(() => document.querySelectorAll('#landDots button')[3].click());
  assert.equal(await t(page, 'land'), 'mountains', 'a dot jumps straight to its landscape');
  assert.equal(await page.$eval('#landDots button.on', b => b.getAttribute('aria-label')), 'Mountain Pass', 'and lights up');
  const layout = JSON.stringify(await t(page, 'layout'));
  await page.evaluate(() => document.getElementById('newLayout').click());
  assert.equal(await t(page, 'land'), 'mountains', 'Another layout keeps the landscape');
  assert.notEqual(JSON.stringify(await t(page, 'layout')), layout, 'but deals a new layout');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('armies find their way over two rivers and through a mountain pass', async () => {
  const page = await openGame();
  for (const [k, regions] of [['tworivers', 2], ['mountains', 1]]) {
    await t(page, 'newMap', k);
    await t(page, 'start');
    await t(page, 'march', 'Ashford', 'Redmarsh', 90);
    let reached = 0;
    for (let i = 0; i < 16 && reached < regions && await t(page, 'state') === 'play'; i++) { await t(page, 'run', 5); reached = Math.max(reached, await t(page, 'furthest')); }
    assert.ok(reached >= regions || await t(page, 'state') === 'over', `${k}: the army gets across`);
    assert.ok(await t(page, 'dry'), `${k}: nobody ends up in the water or on a mountainside`);
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('random layouts: the same for both sides, the same for the same map number, and playable', async () => {
  const page = await openGame(undefined, RANDOM);
  const lands = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'marsh', 'broken'];
  for (let i = 0; i < lands.length * 3; i++) {
    const k = lands[i % lands.length];
    await t(page, 'newMap', k, 100 + i);
    assert.ok(await t(page, 'mirrored'), `${k} map ${100 + i}: towns, mines, fields, hills, woods and crossings mirror each other`);
  }
  assert.equal(await t(page, 'fallbacks'), 0, 'every random layout fits without falling back to the classic one');
  await t(page, 'newMap', 'highlands', 4821);
  const first = JSON.stringify(await t(page, 'layout'));
  await t(page, 'newMap', 'highlands', 4821);
  assert.equal(JSON.stringify(await t(page, 'layout')), first, 'a map number always rebuilds the same map');
  assert.match(await page.$eval('#mapNo', e => e.textContent), /Map 4821/, 'the start screen shows the map number');
  await page.$eval('#classicTowns', e => e.click());
  assert.ok((await t(page, 'layout')).some(o => o.name === 'Millbrook') && (await t(page, 'layout')).length === 10, 'Classic towns brings back the original layout');
  await page.$eval('#classicTowns', e => e.click());
  await t(page, 'newMap', 'valley', 77);
  await t(page, 'start'); await t(page, 'run', 30);
  assert.ok(await t(page, 'dry') && await t(page, 'alive') > 20, 'a random map plays');
  assert.deepEqual(page.errors, []);
  await page.evaluate(() => localStorage.removeItem('frontlines-classic'));
  await page.close();
});

test('the Sound button silences everything', async () => {
  const page = await openGame();
  await toStart(page);
  await page.click('#startBtn');   // a real click: browsers only let a page play sound after one
  await t(page, 'melee');
  await sleep(300);
  if (await page.evaluate(() => document.getElementById('soundBtn').textContent) === 'Sound off') await page.click('#soundBtn');
  await page.click('#soundBtn');
  await sleep(200);
  assert.equal(await page.evaluate(() => document.getElementById('soundBtn').textContent), 'Sound off');
  assert.equal(await t(page, 'audio'), 'suspended', 'muting pauses the whole audio engine, so nothing can play');
  await t(page, 'hitCapital');
  await sleep(200);
  assert.equal(await t(page, 'audio'), 'suspended', 'the war horn does not wake it up');
  await page.click('#soundBtn');
  await sleep(200);
  assert.equal(await t(page, 'audio'), 'running', 'unmuting brings the sound back');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('phone layout with touch', async () => {
  const page = await openGame({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // through the start screen's steps by touch: the welcome (on a first visit), the map, the difficulty
  if (await page.$eval('#intro', e => e.dataset.step === '1')) await page.tap('#step1 [data-go="2"]');
  await page.tap('#step2 [data-go="3"]');
  await page.tap('#startBtn');
  await sleep(500);
  const board = await t(page, 'pos', 'Ashford');
  assert.ok(board.x > 0 && board.x < 390 && board.y > 0 && board.y < 844, 'the board fits on a phone screen');
  assert.deepEqual(page.errors, []);
  await page.close();
});
