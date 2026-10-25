// Browser tests for Frontlines. They open the built game (site/index.html?test) in headless Chrome
// and play it with real mouse and touch input. The ?test URL flag exposes a small hook, window.__t,
// for finding towns on screen, fast-forwarding time and staging fights (see the end of frontlines.html).
//
// Run from this folder:  npm install && npm test
// Chrome is found automatically on macOS and Linux; set CHROME_PATH to use another browser binary.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { race, BOARD, MATCH } from './twins.mjs';

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
  const step = () => page.$eval('#intro', e => +e.dataset.step);
  assert.equal(await step(), 1, 'the start screen opens on the welcome');
  const active = () => page.evaluate(() => [...document.querySelectorAll('#carousel .slide')].findIndex(s => s.classList.contains('on')));
  assert.equal(await active(), 0, 'the tips start at the first one');
  await sleep(2000);
  assert.equal(await active(), 0, 'and wait for the reader: they never move on by themselves');
  await page.click('#tipDots button:nth-child(3)');
  assert.equal(await active(), 2, 'a dot jumps to its tip');
  await page.click('#tipDots button:first-child');
  await page.click('#tipNext');
  assert.equal(await active(), 1, 'the next arrow moves on');
  await page.click('#tipPrev'); await page.click('#tipPrev');
  const slides = await page.$$eval('#carousel .slide', s => s.length);
  assert.equal(await active(), slides - 1, 'going back from the first tip wraps to the last');
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
  assert.equal(await page.$eval('#levelv', e => e.textContent), 'Hard', 'the top-left panel shows the difficulty too');
  await page.click('#step3 [data-go="2"]');
  assert.equal(await step(), 2, 'Back goes back');
  await page.reload(); await page.waitForFunction(() => window.__t, { timeout: 20000 });
  assert.equal(await step(), 1, 'and it does every visit');
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

test('the weekly dialog waits for a route being drawn', async () => {
  const page = await openGame();
  await t(page, 'start');
  await dragTo(page, await t(page, 'pos', 'Brindle'), await t(page, 'pos', 'Millbrook'));
  await t(page, 'offer');   // the week ends mid-drag
  await sleep(400);
  assert.equal(await t(page, 'state'), 'upgrade', 'the battle freezes on time');
  assert.ok(await page.$eval('#upgrade', e => e.hidden), 'but the dialog waits while the route is in hand');
  await page.mouse.up();
  await sleep(100);
  assert.equal(await t(page, 'route', 'Brindle'), 'Millbrook', 'the route still takes');
  await sleep(400);
  assert.ok(!(await page.$eval('#upgrade', e => e.hidden)), 'and the dialog opens once it is let go');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the weekly dialog waits for a watchtower being placed', async () => {
  const page = await openGame();
  await t(page, 'start');
  await page.click('#tray-tower');
  const spot = await t(page, 'pos', 'Ashford', 70, 40);
  await page.mouse.move(spot.x, spot.y);
  await sleep(400);
  await t(page, 'offer');   // the week ends while the tower is in hand
  await sleep(400);
  assert.ok(await page.$eval('#upgrade', e => e.hidden), 'the dialog waits while the tower is in hand');
  await page.mouse.click(spot.x, spot.y);
  await sleep(100);
  assert.equal(await t(page, 'buildings'), 1, 'the tower can still be placed on the frozen board');
  await sleep(400);
  assert.ok(!(await page.$eval('#upgrade', e => e.hidden)), 'and the dialog opens once it is down');
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

test('Charge: first in the tray, armed with C, then counts down', async () => {
  const page = await openGame();
  await t(page, 'start');
  assert.equal(await page.$eval('#tray', e => e.firstElementChild.id), 'chargeBtn', 'Charge leads the tray');
  assert.match(await page.$eval('#chargeBtn', e => e.textContent), /Ready/);
  await page.keyboard.press('c');
  assert.ok(await page.$eval('#chargeBtn', e => e.classList.contains('armed')), 'C arms it');
  await page.keyboard.press('Escape');
  assert.ok(!(await page.$eval('#chargeBtn', e => e.classList.contains('armed'))), 'Esc cancels');
  await page.click('#chargeBtn');
  const spot = await t(page, 'pos', 'Ashford', 70, 40);
  await page.mouse.click(spot.x, spot.y); await sleep(100);
  assert.ok(await page.$eval('#chargeBtn', e => e.disabled), 'after charging it rests');
  assert.match(await page.$eval('#chargeBtn', e => e.textContent), /\d+s/, 'and counts down');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('Charge sends the soldiers in the circle running at the spot', async () => {
  const page = await openGame();
  await t(page, 'start');
  await t(page, 'army', 'Millbrook', 30, 100);   // an army camped 100 west of Millbrook
  const aim = await t(page, 'pos', 'Millbrook', -10, 80);   // open ground about 120 from the camp
  assert.equal(await t(page, 'near', 0, aim.x, aim.y, 45), 0, 'nobody is there yet');
  await page.keyboard.press('c');
  await page.mouse.click(aim.x, aim.y); await sleep(100);
  assert.ok(await t(page, 'charging') >= 25, 'everyone in the circle sets off');
  await t(page, 'run', 2.5);
  assert.ok(await t(page, 'near', 0, aim.x, aim.y, 45) >= 15, 'and they get there at a sprint');
  await t(page, 'run', 3);
  assert.equal(await t(page, 'charging'), 0, 'then the charge is over and they go back to their orders');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('paused, Shift over the panels, tray and towns explains them; taking a town says so', async () => {
  const page = await openGame();
  await t(page, 'start');
  await page.keyboard.press('Space');
  const centre = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const box = () => page.$eval('#inspect', e => e.hidden ? null : e.textContent);
  let p = await centre('#gold');
  await page.mouse.move(p.x, p.y);
  assert.equal(await box(), null, 'nothing without Shift');
  await page.keyboard.down('Shift');
  assert.match(await box(), /Gold.*earning \d+ a week/, 'the gold: how much and what it earns');
  p = await centre('#tray-farm');
  await page.mouse.move(p.x, p.y);
  assert.match(await box(), /Farm.*Costs 30 gold/, 'a tray item: what it does and what it costs');
  p = await centre('#chargeBtn');
  await page.mouse.move(p.x, p.y);
  assert.match(await box(), /Charge \(C\).*Ready/, 'Charge, and whether it is ready');
  await page.keyboard.up('Shift');
  assert.equal(await box(), null, 'letting go of Shift hides it');
  p = await t(page, 'pos', 'Ashford');
  await page.mouse.move(p.x, p.y);
  await page.keyboard.down('Shift');
  assert.match(await box(), /^Yours\s*Ashford\s*Strength 100% of \d+ · \d+ soldiers? here\s*Trains spearmen · 1 every [\d.]+s · \d+ of its \d+ alive/, 'a town: its strength first');
  await page.keyboard.up('Shift');
  await t(page, 'capture', 'Millbrook', 0);
  assert.match(await page.$eval('#toast', e => e.textContent), /Millbrook captured/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('each troop type beats the one it counters, at equal cost (docs/designreview.md)', async () => {
  // as many of each as the same training time buys: spearmen train in 0.85, archers 1, cavalry 1.4
  const KIND = ['spearmen', 'archers', 'cavalry'], N = [33, 28, 20];
  const page = await openGame(undefined, new URL('../site/index.html?test&land=open', import.meta.url).href);
  for (const [win, lose] of [[0, 2], [2, 1], [1, 0]]) {
    // blue attacks red where it stands, either way round, or both march to meet
    for (const [blue, red, meet] of [[win, lose, false], [lose, win, false], [win, lose, true]]) {
      let left = null;
      for (let map = 100; !left && map < 110; map++) {   // a map with open flat ground for the fight
        await page.goto(new URL(`../site/index.html?test&land=open&map=${map}`, import.meta.url).href);
        await page.waitForFunction(() => window.__t);
        await t(page, 'start');
        await t(page, 'freeze');   // only the duel moves the battle, so every run fights the same fight
        left = await t(page, 'duel', blue, N[blue], red, N[red], meet);
      }
      assert.ok(left, 'found open ground for the fight');
      const w = blue === win ? 0 : 1;
      assert.ok(left[w] > 0 && left[1 - w] === 0,
        `${N[blue]} ${KIND[blue]} ${meet ? 'meeting' : 'attacking'} ${N[red]} ${KIND[red]}: ${KIND[win]} should win (survivors ${left[0]} against ${left[1]})`);
    }
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('a gathered army stands in formation: spearmen in front, archers behind, cavalry on the wings', async () => {
  const page = await openGame();
  await t(page, 'start');
  await page.keyboard.press('Space');
  await t(page, 'army', 'Larkspur', 30, 160);   // by the river: the formation steps aside to keep out of it
  await t(page, 'army', 'Millbrook', 5, 150);   // too few to form up
  await t(page, 'run', 8);
  const cos = await t(page, 'companies');
  assert.equal(cos.length, 1, 'one company: five soldiers are too few');
  const [co] = cos;
  assert.deepEqual([co.team, co.n], [0, [10, 10, 10]]);
  assert.ok(co.placed >= 27, `nearly everyone stands in their place (${co.placed} of 30)`);
  assert.ok(co.depth[0] > co.depth[1] + 15, `spearmen stand in front of the archers (${co.depth.map(Math.round)})`);
  await page.mouse.move(co.member.x, co.member.y);
  await page.keyboard.down('Shift');
  assert.match(await page.$eval('#inspect', e => e.hidden ? '' : e.textContent),
    /Yours.*Company.*30 soldiers in formation: 10 spearmen in front, 10 archers behind, 10 cavalry on the wings/, 'Shift over it names the formation');
  await page.keyboard.up('Shift');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('each company keeps its own banner, even when another marches off', async () => {
  const page = await openGame();
  await t(page, 'start');
  await page.keyboard.press('Space');
  await t(page, 'army', 'Millbrook', 20, 150);   // the first company: it marches home to Ashford, on the same bank
  await t(page, 'army', 'Larkspur', 20, 160);
  await t(page, 'run', 6);
  await sleep(600);   // banners move when the board is drawn
  const before = await t(page, 'banners');
  assert.equal(before.length, 2, 'two companies, two banners');
  const [a] = await t(page, 'companies');
  await dragTo(page, a.member, await t(page, 'pos', 'Ashford'));
  await page.mouse.up();
  await t(page, 'run', 2);
  await sleep(600);
  const after = await t(page, 'banners');
  assert.equal(after.length, 1, 'the company that left takes its banner down');
  assert.ok(before.some(p => Math.hypot(p.x - after[0].x, p.y - after[0].y) < 5), 'the other banner stays with its own company');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('archer companies shoot volleys at an army standing beyond a single archer\'s reach', async () => {
  const page = await openGame(undefined, new URL('../site/index.html?test&land=open&map=100', import.meta.url).href);
  await t(page, 'start');
  await page.keyboard.press('Space');
  assert.ok(await t(page, 'standoff', [1], 7, [0], 30, 160), 'open ground for the fight');
  await t(page, 'run', 10);
  assert.equal(await t(page, 'volleys'), 0, 'seven archers are too few for volleys');
  await t(page, 'standoff', [1], 16, [0], 30, 160);
  await t(page, 'run', 10);
  const [blue, red] = await t(page, 'left');
  assert.ok(await t(page, 'volleys') >= 2, 'sixteen archers shoot volleys');
  assert.ok(red <= 26 && blue === 16, `the spearmen, out of reach, lose men and the archers none (${blue} archers, ${red} spearmen left)`);
  const [co] = (await t(page, 'companies')).filter(c => c.team === 0);
  await page.mouse.move(co.member.x, co.member.y);
  await page.keyboard.down('Shift');
  assert.match(await page.$eval('#inspect', e => e.hidden ? '' : e.textContent), /Archer company.*volley every 4 s/, 'Shift over the company tells of its volleys');
  await page.keyboard.up('Shift');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('8 or more spearmen in a company hold a shield wall: it beats an equal attack and breaks a cavalry charge', async () => {
  const OPEN = new URL('../site/index.html?test&land=open&map=100', import.meta.url).href, page = await openGame(undefined, OPEN);
  // each fight on a fresh battle (a week ends after a minute and waits for a choice): blue marches on red's
  // spearmen, who stand on open ground. Returns how many of red's stand in the wall after 2 s, and the survivors.
  const fight = async (kind, n, red) => {
    await page.goto(OPEN);
    await page.waitForFunction(() => window.__t);
    return page.evaluate((kind, n, red) => {
      __t.start(); __t.freeze();
      if (!__t.standoff([kind], n, [0], red, 240, true)) return null;
      __t.run(2);
      const walls = __t.walls();
      __t.run(45);
      return [walls, ...__t.left()];
    }, kind, n, red);
  };
  let [walls] = await fight(0, 7, 7);
  assert.equal(walls, 0, 'seven spearmen are too few for a wall');
  let blue, red;
  [walls, blue, red] = await fight(0, 33, 33);
  assert.equal(walls, 33, 'all of red\'s 33 spearmen stand in the wall');
  assert.ok(blue === 0 && red >= 6, `the wall beats an equal attack (${red} of 33 left)`);
  [walls, blue, red] = await fight(2, 20, 33);
  assert.ok(blue === 0 && red >= 28, `cavalry break on the wall (${red} of 33 spearmen left)`);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('6 or more riders in a company ride out at archers and cavalry attacking their side, and wheel to charge again', async () => {
  const OPEN = new URL('../site/index.html?test&land=open&map=100', import.meta.url).href, page = await openGame(undefined, OPEN);
  // blue marches on red's spearmen; 12 red riders stand 150 to the side. Returns the most riders out at once,
  // and the most wheeling at once, over 20 s.
  const fight = async (kind, n, riders) => {
    await page.goto(OPEN);
    await page.waitForFunction(() => window.__t);
    return page.evaluate((kind, n, riders) => {
      __t.start(); __t.freeze();
      if (kind === 2 && !riders) __t.standoff([2], n, [2], 20, 200, true);
      else { __t.standoff([kind], n, [0], 24, 240, true); __t.company(1, [2], riders, 120, 150); }
      let out = 0, wheel = 0;
      for (let i = 0; i < 40; i++) { __t.run(0.5); out = Math.max(out, __t.riding()); wheel = Math.max(wheel, __t.wheeling()); }
      return [out, wheel];
    }, kind, n, riders);
  };
  assert.ok((await fight(1, 28, 12))[0] >= 8, 'the riders ride out at archers shooting the spearmen');
  assert.equal((await fight(0, 33, 12))[0], 0, 'they leave attacking spearmen alone');
  assert.equal((await fight(1, 28, 5))[0], 0, 'five riders are too few to ride out');
  assert.ok((await fight(2, 20, 0))[1] > 0, 'riders fighting riders wheel off to charge again');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('farms grow crops, cut them and cart the harvest to their town; unclaimed towns\' fields lie fallow', async () => {
  const page = await openGame(undefined, GAME + '&week=900');
  await t(page, 'start');
  await page.keyboard.press('Space');
  const before = await t(page, 'farms');
  await t(page, 'run', 12);
  const mid = await t(page, 'farms');
  const grew = mid.fields.filter((f, i) => f.owner >= 0 && f.grow > before.fields[i].grow).length;
  assert.ok(grew > 0, `held farms' crops grow (${grew} growing)`);
  assert.ok(mid.fields.filter(f => f.owner < 0).every(f => f.grow === 0 || f.grow < 0.5), 'unclaimed towns\' crops wither');
  await t(page, 'run', 40);
  const after = await t(page, 'farms');
  assert.ok(after.harvests >= 6, `farms are harvested (${after.harvests} harvests in 52 s)`);
  assert.ok(after.fields.some(f => f.owner >= 0 && f.grow < 0.5), 'and sown again');
  let sawCart = false;
  for (let i = 0; i < 40 && !sawCart; i++) { await t(page, 'run', 0.5); sawCart = (await t(page, 'farms')).carts.length > 0; }
  assert.ok(sawCart, 'a cart takes the harvest to town');
  const f = after.fields.find(f => f.owner === 0);
  await page.mouse.move(f.at.x, f.at.y);
  await page.keyboard.down('Shift');
  assert.match(await page.$eval('#inspect', e => e.hidden ? '' : e.textContent), /Farm.*(harvest in \d+s|Being harvested)/, 'Shift over a farm tells where its crops are');
  await page.keyboard.up('Shift');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('towns need food to train at full speed: a fed town trains far faster than a starving one', async () => {
  const page = await openGame(undefined, GAME + '&week=900');
  await t(page, 'start');
  await page.keyboard.press('Space');
  const grow = async food => {
    const n0 = await t(page, 'trained', 'Brindle');
    for (let i = 0; i < 20; i++) { await t(page, 'food', 'Brindle', food); await t(page, 'run', 0.5); }
    return await t(page, 'trained', 'Brindle') - n0;
  };
  const fed = await grow(40), starving = await grow(0);
  assert.ok(fed >= 3 && starving <= fed / 2, `in 10 s Brindle trains ${fed} with food, ${starving} without`);
  const b = await t(page, 'pos', 'Brindle');
  await page.mouse.move(b.x, b.y);
  await page.keyboard.down('Shift');
  assert.match(await page.$eval('#inspect', e => e.hidden ? '' : e.textContent), /Food 0 of 40.*out of food/, 'Shift over a town shows its food');
  await page.keyboard.up('Shift');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('volleys play out the same in two copies, as two players\' browsers must', async () => {
  const pages = await Promise.all([{ width: 1200, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }].map(v => openGame(v, RANDOM)));
  const [a, b] = await Promise.all(pages.map(page => page.evaluate((board, match) => {
    __t.freeze(); __t.board(board); __t.match(match); __t.newMap('open', 100); __t.start();
    __t.standoff([0, 1], 32, [0, 2], 30, 150);
    __t.run(20);
    return { volleys: __t.volleys(), left: __t.left(), parts: __t.snapshot().parts };
  }, BOARD, MATCH)));
  assert.ok(a.volleys >= 2, `volleys were shot (${a.volleys})`);
  assert.deepEqual(a, b);
  for (const page of pages) { assert.deepEqual(page.errors, []); await page.close(); }
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
  for (const k of ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'plateau', 'broken']) {
    assert.equal(await t(page, 'newMap', k), k);
    assert.equal(await page.$eval('#landName', e => e.textContent.length > 0), true, 'the intro names the landscape');
    await t(page, 'start'); await t(page, 'run', 40);
    assert.ok(await t(page, 'dry'), `${k}: no town or soldier is in the water`);
    assert.equal(await t(page, 'onCrag'), 0, `${k}: nobody stands inside a crag`);
    assert.ok(await t(page, 'alive') > 20, `${k}: both kingdoms field armies`);
  }
  const terrain = await t(page, 'newMap', 'highlands') && await t(page, 'terrain');
  assert.ok(terrain.crags > 0, 'the highlands have crags');
  // the arrows step through every landscape once, in order, then starts over
  const seen = [];
  for (let i = 0; i < 10; i++) { await page.evaluate(() => document.getElementById('landNext').click()); seen.push(await t(page, 'land')); }
  assert.equal(new Set(seen).size, 10, 'ten presses visit all ten landscapes');
  assert.equal(seen[9], 'highlands', 'and the tenth comes back round to where it started');
  await page.evaluate(() => document.getElementById('landPrev').click());
  assert.equal(await t(page, 'land'), 'greenwood', 'the back arrow goes the other way');
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

test('maps without a river sell no bridges: none in the tray or among the weekly choices', async () => {
  for (const k of ['open', 'mountains']) {
    const page = await openGame(undefined, RANDOM + '&land=' + k);
    await t(page, 'start');
    assert.equal(await page.$('#tray-bridge'), null, `${k}: no bridge in the tray`);
    assert.ok(await page.$('#tray-tower'), `${k}: the rest of the tray is there`);
    for (let w = 0; w < 30; w++) assert.doesNotMatch(await t(page, 'offer'), /Bridge/, `${k}: no bridge among the weekly choices`);
    assert.deepEqual(page.errors, []);
    await page.close();
  }
  const page = await openGame();
  await t(page, 'start');
  assert.ok(await page.$('#tray-bridge'), 'a river map still sells bridges');
  let offers = '';
  for (let w = 0; w < 30; w++) offers += await t(page, 'offer');
  assert.match(offers, /Bridge/, 'and offers them as a weekly choice');
  await page.close();
});

test('two copies of a battle stay identical, as two players\' browsers must (docs/multiplayer.md)', async () => {
  // different windows, drawing, Math.random and history; same map number, board and orders. npm run drift runs it longer.
  for (const land of ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'plateau', 'broken']) {
    const r = await race(browser, land, 45);
    assert.equal(r.first, null, `${land}: the copies differ from second ${r.first?.s} (${r.first?.parts})`);
    assert.deepEqual(r.errors, []);
  }
});

test('playing red by hand while the computer plays blue: the view turns and red is drawn blue', async () => {
  const page = await openGame();
  await page.evaluate(() => { __t.match({ ai: 0, difficulty: 'normal', classic: true, grace: 6 }); __t.newMap('valley', 4821); __t.start(); });
  assert.equal(await page.evaluate(() => __t.me()), 1, 'this browser plays red');
  const red = await t(page, 'pos', 'Redmarsh'), blue = await t(page, 'pos', 'Ashford');
  assert.ok(red.x < blue.x, 'red\'s capital is on the left, where blue\'s usually is');
  await dragTo(page, await t(page, 'pos', 'Thornby'), await t(page, 'pos', 'Fennick'));   // a route from one of red's towns
  await page.mouse.up();
  await sleep(100);
  assert.equal(await t(page, 'route', 'Thornby'), 'Fennick', 'red draws routes from its own towns');
  await page.click('#tray-tower');
  const spot = await t(page, 'pos', 'Redmarsh', -70, -40);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);
  await sleep(100);
  assert.equal(await t(page, 'buildings'), 1, 'red builds from its own tray');
  await t(page, 'freeze');
  await t(page, 'run', 50);
  assert.equal(await t(page, 'state'), 'upgrade', 'red gets the weekly choice');
  await page.evaluate(() => document.getElementById('choice0').click());
  assert.equal(await t(page, 'state'), 'play', 'and the next week begins');
  const owners = (await t(page, 'layout')).filter(t => t.owner === 0).length;
  assert.ok(owners > 3, `the computer plays blue: it holds ${owners} towns after a week`);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('the computer against the computer (tests/balance.mjs): both sides play, weeks pass by themselves, a capital falls', async () => {
  const pages = await Promise.all([{ width: 1200, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }].map(v => openGame(v, RANDOM)));
  const [a, b] = await Promise.all(pages.map(page => page.evaluate(board => {
    __t.freeze(); __t.board(board); __t.match({ ai: 2, difficulty: 'hard', classic: false, grace: 6, buys: ['farms', 'even'] });
    __t.newMap('valley', 1); __t.start();
    const states = new Set();
    while (__t.war().winner < 0 && __t.war().time < 1200) { __t.run(10); states.add(__t.state()); }
    return { war: __t.war(), states: [...states], dialog: !document.getElementById('over').hidden, parts: __t.snapshot().parts };
  }, BOARD)));
  const { war } = a, [blue, red] = war.sides;
  assert.ok(war.winner >= 0, 'one side took the other\'s capital');
  assert.ok(war.week > 2, `weeks went by without a weekly choice (week ${war.week})`);
  assert.ok(!a.states.includes('upgrade') && !a.dialog, 'no weekly choice and no end dialog, as no one plays');
  assert.ok(blue.bought.farm > red.bought.farm && red.bought.tower > 0, `each side buys in its own way (farms ${blue.bought.farm} and ${red.bought.farm})`);
  assert.ok(blue.burst <= 7 && red.burst <= 7, `at a person's pace: one order every 1.5 s at most (${blue.burst} and ${red.burst} within 10 s)`);
  assert.deepEqual(a, b, 'the same game in two copies');
  for (const page of pages) { assert.deepEqual(page.errors, []); await page.close(); }
});

test('a stand-in for the player (tests/balance.mjs --player): the computer plays the person\'s side by their rules', async () => {
  const page = await openGame({ width: 1200, height: 800 }, RANDOM);
  const r = await page.evaluate(board => {
    __t.freeze(); __t.board(board); __t.match({ ai: 1, standin: true, difficulty: 'normal', classic: false, grace: 6 });
    __t.newMap('valley', 1); __t.start();
    __t.run(15);   // its first few orders, after the 6 s before it starts
    const towers = __t.war().sides[0].towers;
    for (let s = 0; s < 150 && __t.war().winner < 0; s += 5) __t.run(5);
    return { war: __t.war(), towers, state: __t.state() };
  }, BOARD);
  const blue = r.war.sides[0];
  assert.equal(r.towers, 1, 'it puts the watchtower from its tray on the board in its first moves');
  assert.ok(r.war.week >= 3 && r.state !== 'upgrade', `it makes the weekly choice itself (week ${r.war.week})`);
  assert.ok(blue.acts > 20 && blue.burst <= 7, `it plays at a person's pace (${blue.acts} orders, ${blue.burst} within 10 s)`);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('a town holds up to 4 barracks: a fifth is refused', async () => {
  const page = await openGame();
  await t(page, 'start');
  await t(page, 'barracks', 'Ashford', 3);
  const place = async () => {
    await t(page, 'give', 'barracks');
    await page.click('#tray-barracks');
    const a = await t(page, 'pos', 'Ashford');
    await page.mouse.move(a.x, a.y); await page.mouse.click(a.x, a.y);
    await sleep(300);
  };
  await place();
  assert.equal(await t(page, 'barracks', 'Ashford'), 4, 'the fourth goes up');
  await place();
  assert.equal(await t(page, 'barracks', 'Ashford'), 4, 'a fifth is refused');
  assert.match(await page.$eval('#toast', e => e.textContent), /Ashford has all the barracks it can hold/);
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('team colours are always looked up by team or by me, never as a literal 0 or 1', async () => {
  // the palettes swap for the red player (paintTeams), so COL.team[0] is red on their screen: "mine" is [me]
  const src = readFileSync(fileURLToPath(new URL('../frontlines.html', import.meta.url)), 'utf8');
  const hits = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /(ROUTE|CHEVRON|KEEPC|TEAMC|LIGHTC|COL\.(team|light|mid))\[[01]\]|drawRoute\([^()]*,\s*[01]\)/.test(l));   // drawRoute(r, team) colours by team
  assert.deepEqual(hits.map(([n, l]) => `${n}: ${l.trim()}`), []);
});

test('a battle replays exactly from its orders: everything the player does goes through them', async () => {
  // a real game played with the mouse, in real time and while frozen, then its orders played back in a fresh copy
  const page = await openGame();
  await t(page, 'start');
  await dragTo(page, await t(page, 'pos', 'Brindle'), await t(page, 'pos', 'Millbrook'));   // a route
  await page.mouse.up();
  const cold = await t(page, 'pos', 'Coldwater');   // the town menu: train cavalry
  await page.mouse.click(cold.x, cold.y);
  await sleep(100);
  await page.click('#tmK2');
  await page.click('#tray-tower');   // a watchtower
  const spot = await t(page, 'pos', 'Ashford', 70, 40);
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.click(spot.x, spot.y);
  await sleep(1500);
  await page.click('#chargeBtn');   // Charge, on Brindle's soldiers
  const brin = await t(page, 'pos', 'Brindle');
  await page.mouse.click(brin.x + 30, brin.y);
  await sleep(500);
  await t(page, 'freeze');
  await t(page, 'run', 50);   // to the end of the week, where a reward is chosen
  assert.equal(await t(page, 'state'), 'upgrade');
  await page.evaluate(() => document.getElementById('choice0').click());
  await t(page, 'run', 5);
  const rec = await t(page, 'record');
  const types = new Set(rec.orders.map(o => o.type));
  for (const k of ['route', 'train', 'build', 'charge', 'reward']) assert.ok(types.has(k), `the record holds a ${k} order`);

  const copy = await openGame();
  await copy.evaluate(rec => { __t.freeze(); __t.match(rec.match); __t.newMap(rec.land, rec.map); __t.start(); }, rec);
  assert.deepEqual(await t(copy, 'replay', rec), rec.sum, 'the replay ends exactly where the game did');
  assert.deepEqual([...page.errors, ...copy.errors], []);
  await page.close(); await copy.close();
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
  const lands = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'plateau', 'broken'];
  for (let i = 0; i < lands.length * 3; i++) {
    const k = lands[i % lands.length];
    await t(page, 'newMap', k, 100 + i);
    assert.ok(await t(page, 'mirrored'), `${k} map ${100 + i}: towns, mines, fields, hills, woods and crossings mirror each other`);
  }
  assert.equal(await t(page, 'fallbacks'), 0, 'every random layout fits without falling back to the classic one');
  const steppe = (await t(page, 'newMap', 'steppe'), await t(page, 'terrain')), plateau = (await t(page, 'newMap', 'plateau'), await t(page, 'terrain'));
  assert.equal(plateau.towns, 6, 'the plateau has six towns: a capital and one more each, and a neutral pair');
  assert.ok(plateau.towns < steppe.towns && plateau.roads < steppe.roads && plateau.trees < steppe.trees, 'and fewer towns, roads and trees than the steppe');
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

test('tips can be turned off from any tip, and back on under Rules', async () => {
  const page = await openGame();
  await page.evaluate(() => { localStorage.removeItem('frontlines-coach'); localStorage.removeItem('frontlines-tips-off'); });
  await page.reload(); await page.waitForFunction(() => window.__t, { timeout: 20000 });
  await t(page, 'start');
  const tipShown = () => page.$eval('#coach', e => !e.hidden);
  for (let i = 0; i < 20 && !(await tipShown()); i++) await t(page, 'run', 2);
  assert.ok(await tipShown(), 'a tip turns up');
  await page.click('#coachOff');
  assert.ok(!(await tipShown()), 'Turn off tips hides it');
  for (let i = 0; i < 10; i++) await t(page, 'run', 2);
  assert.ok(!(await tipShown()), 'and no more tips come');
  // (the week may have ended by now, with its dialog up, so use the rules sheet's switch directly)
  assert.equal(await page.$eval('#tipsOn', e => e.checked), false, 'the rules sheet shows tips as off');
  await page.$eval('#tipsOn', e => e.click());
  assert.equal(await page.evaluate(() => localStorage.getItem('frontlines-tips-off')), '0', 'and can turn them back on');
  assert.deepEqual(page.errors, []);
  await page.evaluate(() => localStorage.removeItem('frontlines-tips-off'));
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
