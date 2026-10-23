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
async function until(page, fn, what, ms = 8000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await page.evaluate(fn)) return;
  throw new Error(`timed out waiting for ${what}`);
}
// a player: their own browser storage, like a separate machine
async function player(srv, viewport) {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport(viewport);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.port}/?test`);
  await page.waitForFunction(() => window.__t);
  return page;
}
// a host on a laptop and a guest on a phone, in a started match on River Valley, map 4821
async function match(srv) {
  const host = await player(srv, { width: 1200, height: 800 }), guest = await player(srv, { width: 390, height: 844, isMobile: true, hasTouch: true });
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
  await sleep(1500);
  for (const p of [host, guest]) {
    assert.equal(await t(p, 'route', 'Ashford'), hostTo, 'the host\'s route reaches both games');
    assert.equal(await t(p, 'route', 'Redmarsh'), guestTo, 'the guest\'s route reaches both games');
  }
  await sleep(2500);
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
  await sleep(4000);
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
  await sleep(3000);
  const h = await t(host, 'net'), g = await t(guest, 'net');
  assert.ok(h.turn > held + 40, `the battle carries on (turn ${h.turn})`);
  for (const n of [h, g]) assert.equal(n.desync, -1, 'still in sync after the rejoin');
  assert.ok(g.agreed >= 2, `the rejoined guest's checksums agree (${g.agreed} times)`);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});
