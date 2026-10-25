// Two-player matches (docs/multiplayer.md, phase 4): two browser pages play through the relay in server/,
// started here on a free port, and must stay in sync: same orders on the same turns, same checksums.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../server/relay.mjs';
import { SITE, LAPTOP, sleep, launch, t, until, player as newPlayer, pair, close } from './players.mjs';

let browser, server, slow;

before(async () => {
  browser = await launch();
  server = await start({ port: 0, site: SITE });
  slow = await start({ port: 0, site: SITE, delay: 60 });   // every message held back 60 ms: about 120 ms there and back
});
after(async () => { await browser?.close(); await server?.close(); await slow?.close(); });

const player = (srv, viewport, query) => newPlayer(browser, srv, viewport, query);
// a host on a laptop and a guest on a phone, in a started match on River Valley, map 4821
// lateGuest: the guest's countdown runs slowly, so the host begins (and sends turns) well before the guest does
async function match(srv, query = '', lateGuest = false) {
  const { host, guest, code } = await pair(browser, srv, { host: query, guest: query + (lateGuest ? '&count=700' : '') });
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}$/, 'a four-character code without 0/O or 1/I');
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

test('two players play a match through the relay, each with their own side, and stay in sync', async () => {
  // the guest finishes the countdown last, after the host has begun sending turns, as a slow phone would
  const { host, guest } = await match(server, '', true);
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
  const host = await player(server, LAPTOP), guest = await player(server, LAPTOP);
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
  await until(guest, () => /River Valley|Valley|Lake|Rivers|Pass|Border|Steppe|Greenwood|Highlands|Plateau|Bridges/.test(document.getElementById('joinTitle').textContent), 'the host\'s map on the welcome card');
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
  const { host, guest } = await match(server, '&week=2&pick=60');   // 60 turns (3 s) instead of 300, for slow CI machines
  await until(host, () => __t.state() === 'upgrade' && !document.getElementById('upgrade').hidden, 'the end of the week');
  await host.evaluate(() => document.getElementById('choice0').click());
  assert.match(await host.$eval('#choices', e => e.textContent), /Waiting for Bo to choose/);
  await sleep(1000);
  assert.equal(await t(host, 'state'), 'upgrade', 'the battle waits for the other player');
  assert.match(await guest.$eval('#upLabel', e => e.textContent), /Week 1 complete · \d+ s/, 'the guest sees the time left');
  await until(host, () => __t.state() === 'play', 'the guest\'s reward to be chosen for them', 60000);
  await until(guest, () => __t.state() === 'play' && document.getElementById('upgrade').hidden, 'the guest\'s dialog to close', 20000);
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
  await sleep(2000);   // the battle plays on behind the dialog, without the guest's turns
  assert.doesNotMatch(await host.$eval('#hint', e => e.textContent), /Waiting/, 'no one to wait for once the battle is over');
  await t(guest, 'netRejoin');
  await until(guest, () => /over/.test(document.getElementById('toast').textContent), 'the late guest to hear the game is over');
  await close(host, guest);
});

// The short version of `npm run matches`: the computer plays both sides through the relay, a busy battle with
// orders from both, a weekly choice, and a dropout and rejoin in the middle of it.
test('two bots play a busy match through the relay, with a dropout, and stay in sync', async () => {
  const { host, guest } = await match(server, '&bot&speed=2');
  for (const p of [host, guest]) await until(p, () => __t.net().time > 35, 'the battle to get going', 90000);
  await t(guest, 'netDrop');
  await sleep(1500);
  await t(guest, 'netRejoin');
  await until(guest, () => __t.net().live && __t.net().turn > 0, 'the guest to catch up');
  for (const p of [host, guest]) await until(p, () => __t.net().desync >= 0 || (__t.net().time > 60 && __t.net().agreed >= 5), 'the battle to carry on past the first week', 90000);
  for (const p of [host, guest]) {
    const n = await t(p, 'net');
    assert.equal(n.desync, -1, `in sync (${p === host ? 'host' : 'guest'}, checksums agreed ${n.agreed} times)`);
    assert.ok(n.orders[0] >= 5 && n.orders[1] >= 5, `both sides gave orders (${n.orders.join(' and ')})`);
  }
  assert.ok(await t(host, 'war').then(w => w.week >= 2), 'a week passed, its rewards chosen by both bots');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('a lost connection comes back by itself, and a player back too late is told they lost', async () => {
  const { host, guest } = await match(server, '&bot&speed=2&away=3');
  for (const p of [host, guest]) await until(p, () => __t.net().time > 10, 'the battle to get going', 60000);
  // each loses the connection in turn, and the game reconnects and carries on, without replaying the battle
  for (const p of [guest, host]) {
    const before = await t(p, 'net');
    await t(p, 'netBlip');
    await until(p, () => !__t.net().online, 'the connection to drop');
    await until(p, () => __t.net().online, 'the game to reconnect by itself', 20000);
    for (const q of [host, guest]) await until(q, turn => __t.net().turn > turn + 60, 'the battle to carry on', 60000, before.turn);
    const after = await t(p, 'net');
    assert.ok(after.agreed > before.agreed, `the same game, not a replay (checksums agreed ${before.agreed}, then ${after.agreed} times)`);
  }
  for (const p of [host, guest]) assert.equal((await t(p, 'net')).desync, -1, 'in sync after both reconnected');
  // the line stays down for longer than the opponent waits: a walkover, and the late player hears so once back
  await t(guest, 'netDrop');
  await until(host, () => !document.getElementById('over').hidden, 'the walkover', 20000);
  assert.equal(await host.$eval('#overTitle', e => e.textContent), 'Bo left the battle');
  await t(guest, 'netUp');
  await until(guest, () => !document.getElementById('over').hidden, 'the late player to be told', 20000);
  assert.equal(await guest.$eval('#overTitle', e => e.textContent), 'You were away too long');
  assert.match(await guest.$eval('#overLabel', e => e.textContent), /Defeat/);
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});

test('a player who reloads the page gets back in: the host while inviting, then each during the battle', async () => {
  const host = await player(server, LAPTOP, '&bot&speed=2'), guest = await player(server, LAPTOP, '&bot&speed=2');
  await t(host, 'netHost', 'Ann');
  await until(host, () => __t.net().code, 'a room code');
  const { code } = await t(host, 'net');
  const reload = async p => { await p.reload(); await p.waitForFunction(() => window.__t); };
  await reload(host);
  await until(host, c => document.getElementById('bigCode').textContent === c && !document.getElementById('intro').hidden, 'the invitation again, with the same code', 20000, code);
  await t(guest, 'netJoin', code, 'Bo');
  await until(host, () => document.getElementById('waitTitle').textContent === 'Bo has joined', 'the host to see the guest');
  await t(host, 'netStart', 'valley', 4821);
  for (const p of [host, guest]) await until(p, () => __t.net()?.live && __t.net().time > 10, 'the battle to get going', 60000);
  for (const p of [guest, host]) {
    await reload(p);
    await until(p, () => __t.net()?.live && __t.net().turn > 0, 'the reloaded page to get back in', 30000);
    for (const q of [host, guest]) await until(q, () => __t.net().agreed >= 2, 'checksums to be compared again', 60000);
  }
  assert.equal(await t(host, 'me'), 0); assert.equal(await t(guest, 'me'), 1);
  for (const p of [host, guest]) assert.equal((await t(p, 'net')).desync, -1, 'in sync after both reloaded');
  assert.deepEqual([...host.errors, ...guest.errors], []);
  await close(host, guest);
});
