// Two-player matches (docs/multiplayer.md, phase 4): two browser pages play through the relay in server/,
// started here on a free port, and must stay in sync: same orders on the same turns, same checksums.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { start } from '../server/relay.mjs';

const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let browser, server, slow;

before(async () => {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });
  server = await start({ port: 0, site: SITE });
  slow = await start({ port: 0, site: SITE, delay: 60 });   // every message held back 60 ms: about 120 ms there and back
});
after(async () => { await browser?.close(); await server?.close(); await slow?.close(); });

const t = (page, fn, ...args) => page.evaluate((fn, args) => window.__t[fn](...args), fn, args);
// waits for fn (run in the page, with arg) to come true; generous, as CI machines draw in software and run slowly
async function until(page, fn, what, ms = 20000, arg) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await page.evaluate(fn, arg)) return;
  throw new Error(`timed out waiting for ${what}`);
}
// a player: their own browser storage, like a separate machine
async function player(srv, viewport, query = '') {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport(viewport);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.port}/?test${query}`);
  await page.waitForFunction(() => window.__t);
  return page;
}
// a host on a laptop and a guest on a phone, in a started match on River Valley, map 4821
async function match(srv, query) {
  const host = await player(srv, { width: 1200, height: 800 }, query), guest = await player(srv, { width: 390, height: 844, isMobile: true, hasTouch: true }, query);
  await t(host, 'netHost', 'Ann');
  await until(host, () => __t.net().code, 'a room code');
  const { code } = await t(host, 'net');
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/, 'a four-character code without 0/O or 1/I');
  await t(guest, 'netJoin', code, 'Bo');
  await until(guest, () => __t.net().team === 1, 'the guest to join');
  await t(host, 'netStart', 'valley', 4821);
  for (const p of [host, guest]) await until(p, () => __t.net().live, 'the match to start');
  return { host, guest };
}
// the neutral town nearest to a side's capital
async function nearestFree(page, capital) {
  const l = await t(page, 'layout'), c = l.find(x => x.name === capital);
  return l.filter(x => x.owner < 0).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0].name;
}
async function drag(page, from, to) {
  const a = await t(page, 'pos', from), b = await t(page, 'pos', to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 20, a.y + (b.y - a.y) * i / 20); await sleep(16); }
  await page.mouse.up();
}
async function close(...pages) { for (const p of pages) await p.browserContext().close(); }

test('two players play a match through the relay, each with their own side, and stay in sync', async () => {
  const { host, guest } = await match(server);
  assert.equal(await t(host, 'me'), 0); assert.equal(await t(guest, 'me'), 1);
  // the board is the host's (a wide one here), turned for the guest: red's capital where the host sees blue's
  const [hA, hR, gA, gR] = [await t(host, 'pos', 'Ashford'), await t(host, 'pos', 'Redmarsh'), await t(guest, 'pos', 'Ashford'), await t(guest, 'pos', 'Redmarsh')];
  assert.equal(Math.sign(hR.x - hA.x), Math.sign(gA.x - gR.x), 'each player sees their own capital on the same side of the board');
  const hostTo = await nearestFree(host, 'Ashford'), guestTo = await nearestFree(guest, 'Redmarsh');
  await drag(host, 'Ashford', hostTo);     // each player draws a route from their own capital
  await drag(guest, 'Redmarsh', guestTo);
  for (const p of [host, guest]) await until(p, ([a, b]) => __t.route('Ashford') === a && __t.route('Redmarsh') === b, 'both routes to reach both games', 60000, [hostTo, guestTo]);
  for (const p of [host, guest]) await until(p, () => __t.net().turn > 60 && __t.net().agreed >= 3, 'the battle to move on and checksums to be compared', 60000);
  for (const p of [host, guest]) {
    const n = await t(p, 'net');
    assert.equal(n.desync, -1, 'no checksum ever differed');
    assert.ok(n.agreed >= 3, `checksums were compared and agreed (${n.agreed} times)`);
    assert.ok(n.turn > 60, `the battle moves on (turn ${n.turn})`);
  }
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('a match stays in sync with a slow connection', async () => {
  const { host, guest } = await match(slow);
  await drag(host, 'Ashford', await nearestFree(host, 'Ashford'));
  await drag(guest, 'Redmarsh', await nearestFree(guest, 'Redmarsh'));
  for (const p of [host, guest]) await until(p, () => __t.net().turn > 40 && __t.net().agreed >= 2, 'the battle to move on despite the delay', 60000);
  for (const p of [host, guest]) {
    const n = await t(p, 'net');
    assert.equal(n.desync, -1);
    assert.ok(n.agreed >= 2, `checksums agreed ${n.agreed} times`);
    assert.ok(n.turn > 40, `the battle moves on despite the delay (turn ${n.turn})`);
  }
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('a player who drops out rejoins, replays the battle and carries on in sync', async () => {
  const { host, guest } = await match(server);
  await drag(guest, 'Redmarsh', await nearestFree(guest, 'Redmarsh'));
  await sleep(2000);
  await t(guest, 'netDrop');
  await sleep(1500);
  const held = (await t(host, 'net')).turn;
  assert.ok((await t(host, 'net')).waiting, 'the host waits for the missing player');
  await sleep(500);
  assert.equal((await t(host, 'net')).turn, held, 'and the battle holds still meanwhile');
  await t(guest, 'netRejoin');
  await until(guest, () => __t.net().live && __t.net().turn > 0, 'the guest to catch up');
  await until(host, held => __t.net().turn > held + 40, 'the battle to carry on', 20000, held);
  await until(guest, () => __t.net().agreed >= 2, 'the rejoined guest to compare checksums');
  const h = await t(host, 'net'), g = await t(guest, 'net');
  assert.ok(h.turn > held + 40, `the battle carries on (turn ${h.turn})`);
  for (const n of [h, g]) assert.equal(n.desync, -1, 'still in sync after the rejoin');
  assert.ok(g.agreed >= 2, `the rejoined guest's checksums agree (${g.agreed} times)`);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('playing a friend through the screens: invite, join by link, battle, pause, give up, rematch', async () => {
  const host = await player(server, { width: 1200, height: 800 }), guest = await player(server, { width: 1200, height: 800 });
  guest.on('dialog', d => d.accept());   // Give up asks first
  const text = (p, sel) => p.$eval(sel, e => e.textContent);
  const shown = (p, sel) => p.$eval(sel, e => !e.hidden && e.offsetParent !== null);
  // the host: Play a friend, a map, Invite
  await host.click('#friendBtn');
  await host.click('#inviteBtn');
  await until(host, () => /^[A-Z2-9]{4}$/.test(document.getElementById('bigCode').textContent), 'the code');
  const code = await text(host, '#bigCode'), link = await host.$eval('#inviteLink', e => e.value);
  assert.ok(link.endsWith('#' + code), `the link carries the code (${link})`);
  await host.type('#hostName', 'Ann');
  await host.$eval('#hostName', e => e.dispatchEvent(new Event('change')));
  // the guest opens the link, names themself and joins
  await guest.goto(`http://127.0.0.1:${server.port}/?test#${code}`);
  await guest.waitForFunction(() => window.__t);
  assert.ok(await shown(guest, '#stepJoin'), 'a link opens the welcome card');
  await guest.type('#guestName', 'Bo');
  await guest.click('#joinBtn');
  await until(guest, () => /River Valley|Valley|Lake|Rivers|Pass|Border|Steppe|Greenwood|Highlands|Marshes|Bridges/.test(document.getElementById('joinTitle').textContent), 'the host\'s map on the welcome card');
  await until(host, () => document.getElementById('waitTitle').textContent === 'Bo has joined', 'the host to see the guest');
  // the host picks another landscape; the guest's card follows
  await host.click('#waitBack');
  await host.click('#landNext');
  const landName = await text(host, '#landName');
  await host.click('#inviteBtn');
  await until(guest, n => document.getElementById('joinTitle').textContent === `A battle on ${n}`, 'the guest to see the new map', 20000, landName);
  assert.match(await text(guest, '#joinText'), /Ann is choosing/);
  // the battle: a countdown, then each sees the other on the chip
  assert.equal(await host.$eval('#beginBtn', e => e.disabled), false);
  await host.click('#beginBtn');
  for (const p of [host, guest]) await until(p, () => __t.net().live && __t.net().turn > 5, 'the battle to begin');
  assert.equal(await text(host, '#oppName'), 'Bo'); assert.equal(await text(guest, '#oppName'), 'Ann');
  assert.equal(await host.$eval('#speedBtn', e => e.hidden), true, 'no speed button in a match');
  // either player pauses both battles, and either resumes
  await host.click('#pauseBtn');
  await until(guest, () => __t.net().held, 'the pause to reach the guest');
  const t1 = (await t(guest, 'net')).time;
  await sleep(600);
  assert.equal((await t(guest, 'net')).time, t1, 'while paused, the battle stands still');
  assert.equal(await text(guest, '#pauseBtn'), '▶ Resume');
  await guest.click('#pauseBtn');
  await until(host, () => !__t.net().held, 'the resume to reach the host');
  // the guest gives up: a win for the host
  await guest.click('#rulesBtn');
  await guest.click('#giveUpBtn');
  await until(host, () => !document.getElementById('over').hidden, 'the end of the battle for the host');
  assert.equal(await text(host, '#overTitle'), 'Bo gave up');
  assert.match(await text(host, '#overLabel'), /Victory · against Bo/);
  await until(guest, () => !document.getElementById('over').hidden, 'the end of the battle for the guest');
  assert.match(await text(guest, '#overLabel'), /Defeat/);
  // a rematch, once both ask
  await host.click('#againBtn');
  assert.match(await text(host, '#againBtn'), /Waiting for Bo/);
  await guest.click('#againBtn');
  for (const p of [host, guest]) await until(p, () => __t.net().live && document.getElementById('over').hidden && __t.state() === 'play', 'the rematch to begin');
  for (const p of [host, guest]) assert.equal((await t(p, 'net')).desync, -1);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('the weekly choice in a match: each picks their own, and a slow player gets the first reward after 15 s', async () => {
  const { host, guest } = await match(server, '&week=2');
  await until(host, () => __t.state() === 'upgrade' && !document.getElementById('upgrade').hidden, 'the end of the week');
  await host.evaluate(() => document.getElementById('choice0').click());
  assert.match(await host.$eval('#choices', e => e.textContent), /Waiting for Bo to choose/);
  await sleep(1000);
  assert.equal(await t(host, 'state'), 'upgrade', 'the battle waits for the other player');
  assert.match(await guest.$eval('#upLabel', e => e.textContent), /Week 1 complete · \d+ s/, 'the guest sees the time left');
  await until(host, () => __t.state() === 'play', 'the guest\'s reward to be chosen for them', 25000);
  await until(guest, () => __t.state() === 'play' && document.getElementById('upgrade').hidden, 'the guest\'s dialog to close', 5000);
  for (const p of [host, guest]) assert.equal((await t(p, 'net')).desync, -1);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('a player who stays away loses by walkover', async () => {
  const { host, guest } = await match(server, '&away=2');
  await until(host, () => __t.net().turn > 20, 'the battle to begin');
  await t(guest, 'netDrop');
  await until(host, () => !document.getElementById('over').hidden, 'the walkover', 10000);
  assert.equal(await host.$eval('#overTitle', e => e.textContent), 'Bo left the battle');
  assert.match(await host.$eval('#overLabel', e => e.textContent), /Victory/);
  await t(guest, 'netRejoin');
  await until(guest, () => /over/.test(document.getElementById('toast').textContent), 'the late guest to hear the game is over');
  await close(host, guest);
});
