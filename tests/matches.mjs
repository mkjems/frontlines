// Bots playing real matches (docs/multiplayer.md, phase 6): in each match two browser pages play each other
// through a local relay, each with the computer playing its own side and sending its orders like a person's
// clicks (?test&bot). Whole matches run side by side, each under one rough condition, and are checked: in sync to
// the end (checksums), the same winner on both screens, no stalls, no page errors. Not part of `npm test`, which
// has a short version (match.test.mjs).
//
//   npm run matches                          one match per scenario below, side by side, each on its own landscape
//   npm run matches -- --only plain,drop     some of the scenarios
//   npm run matches -- --repeat 3            each scenario three times, on different maps
//   npm run matches -- --mins 8 --speed 4    up to 8 game minutes each, turns 4 times faster than real time
//
// Scenarios (the host is on a laptop, the guest on a phone, so they play on a square board):
//   plain    nothing more
//   lag      every message held back 40 to 120 ms (still in order)
//   drop     the guest loses the connection for 8 s, twice; the game reconnects by itself
//   gone     the guest loses the connection for 40 s: the host wins by walkover after 30, and the guest is told
//   slow     the guest's machine runs 4 times slower (an old phone)
//   hidden   the host's tab is frozen for 10 s, as a phone does to a browser in the background (Chrome then
//            closes its connection, as a phone often does when you switch apps)
//   reload   the guest reloads the page mid-battle, later the host does: each should rejoin and carry on
//   pick     the guest takes 20 s over each weekly choice, so it's made for them after 15
//   rematch  when the battle ends (or at the time limit, the guest gives up) both ask for a rematch, which is
//            played for another minute

import { parseArgs } from 'node:util';
import { start } from '../server/relay.mjs';
import { SITE, sleep, launch, t, pair, close } from './players.mjs';

const SCENARIOS = ['plain', 'lag', 'drop', 'gone', 'slow', 'hidden', 'reload', 'pick', 'rematch'];
const LANDS = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'plateau', 'broken'];
const { values: opt } = parseArgs({ options: {
  only: { type: 'string', default: SCENARIOS.join(',') }, repeat: { type: 'string', default: '1' },
  mins: { type: 'string', default: '10' }, speed: { type: 'string', default: '3' },
} });
const MINS = +opt.mins, SPEED = +opt.speed, STUCK_S = 60;
const jobs = opt.only.split(',').flatMap(s => {
  if (!SCENARIOS.includes(s)) throw new Error(`no scenario ${s}; there are ${SCENARIOS.join(', ')}`);
  return Array.from({ length: +opt.repeat }, (_, i) => s);
}).map((scenario, i) => ({ scenario, land: LANDS[i % LANDS.length], map: 1 + i }));

const browser = await launch();
const server = await start({ port: 0, site: SITE }), laggy = await start({ port: 0, site: SITE, delay: 40, jitter: 80 });
const started = Date.now();

// one match: played until both screens show the end (and a rematch has run, for that scenario), or until the
// time limit; returns what's needed for the report
async function play({ scenario, land, map }) {
  const q = `&bot&speed=${SPEED}`;
  const r = { scenario, land, map, problems: [], stall: 0 };
  const { host, guest } = await pair(browser, scenario === 'lag' ? laggy : server, {
    land, map, host: q, guest: scenario === 'pick' ? `&bot=20&speed=${SPEED}` : q, slow: scenario === 'slow' ? 4 : 1, consoleErrors: true,
  });
  const pages = [host, guest];
  const both = fn => Promise.all(pages.map(p => p.evaluate(fn)));
  // each screen: its match (none, if a reloaded page didn't get back in), the battle and the end dialog
  const look = () => both(() => ({ ...(__t.net() || { live: false, turn: -1, time: 0, desync: -1, agreed: 0, orders: [0, 0] }),
    state: __t.state(), war: __t.war(), label: document.getElementById('overLabel').textContent }));
  // the guest's line goes down for a while, and comes back
  const away = async ms => { await t(guest, 'netDrop'); await sleep(ms); await t(guest, 'netUp'); };
  const freeze = async (page, ms) => {
    const cdp = await page.createCDPSession();
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await sleep(ms);
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });   // and the player looks at it again
  };
  const reload = async page => { await page.reload(); await page.waitForFunction(() => window.__t); };
  // events by game second, each once
  const events = {
    drop: [[60, () => away(8000)], [180, () => away(8000)]],
    gone: [[60, () => away(40000)]],
    hidden: [[90, () => freeze(host, 10000)]],
    reload: [[60, () => reload(guest)], [150, () => reload(host)]],
  }[scenario] || [];
  let last = null, still = 0, rematched = false, endAt = MINS * 60, n = [];
  for (;;) {
    await sleep(500);
    n = await look();
    const [h, g] = n;
    // a stall: no turn run on either side for a while, though the battle should be moving
    if (last && h.turn === last[0].turn && g.turn === last[1].turn && !h.held) still += 0.5; else still = 0;
    r.stall = Math.max(r.stall, still);
    last = n;
    if (h.desync >= 0 || g.desync >= 0) { r.problems.push(`out of sync at turn ${Math.max(h.desync, g.desync)}`); break; }
    if (still >= STUCK_S) { r.problems.push(`stuck for ${STUCK_S} s at turns ${h.turn}/${g.turn}`); break; }
    const time = Math.min(h.time, g.time);
    while (events.length && time >= events[0][0]) await events.shift()[1]();
    const over = h.state === 'over' && g.state === 'over';
    if (scenario === 'rematch' && !rematched && (over || time >= endAt)) {
      if (!over) {
        await guest.evaluate(() => document.getElementById('giveUpBtn').click());
        for (let i = 0; i < 40 && (await look()).some(x => x.state !== 'over'); i++) await sleep(250);
      }
      r.first = await outcome(await look());
      for (const p of pages) await p.evaluate(() => document.getElementById('againBtn').click());
      rematched = true;
      r.rematchAsked = Date.now();
      continue;
    }
    if (rematched) {
      if (!r.rematchAt && n.every(x => x.live && x.state === 'play' && x.time < 5)) r.rematchAt = Date.now();
      if (!r.rematchAt && Date.now() - r.rematchAsked > 30000) { r.problems.push('the rematch never began'); break; }
      if (r.rematchAt && time >= 60) break;
      continue;
    }
    if (over || time >= endAt) break;
  }
  Object.assign(r, await outcome(n));
  // Chrome's own note when a frozen tab's connection is closed isn't an error of the game's
  for (const [who, p] of [['host', host], ['guest', guest]]) for (const e of new Set(p.errors)) if (!/Back-Forward Cache/.test(e)) r.problems.push(`${who}: ${e.slice(0, 160)}`);
  if (!r.agree) r.problems.push(`the screens disagree on the result: ${r.labels.join(' / ')}`);
  if (r.orders.some(x => x < 5)) r.problems.push(`a side hardly played (orders ${r.orders.join('/')})`);
  await close(host, guest);
  return r;
}
// who won, by each screen: the end dialog says Victory or Defeat, and a fallen capital sets the war's winner
async function outcome([h, g]) {
  const said = [h, g].map(x => x.state !== 'over' ? null : /^Victory/.test(x.label) ? 'won' : 'lost');
  const winner = said[0] === 'won' ? 'host' : said[0] === 'lost' ? 'guest' : '-';
  return {
    winner, labels: [h.label, g.label], time: Math.min(h.time, g.time), week: h.war.week, agreed: Math.min(h.agreed, g.agreed),
    orders: h.orders, towns: h.war.sides.map(s => s.towns), turn: Math.min(h.turn, g.turn),
    agree: said[0] === null && said[1] === null || (said[0] && said[1] && said[0] !== said[1] && h.war.winner === g.war.winner),
  };
}

const results = await Promise.all(jobs.map(j => play(j).catch(e => ({ ...j, problems: [`crashed: ${e.message}`], winner: '-', orders: [], towns: [] }))));
await browser.close(); await server.close(); await laggy.close();

const head = ['scenario', 'landscape', 'map', 'winner', 'minutes', 'week', 'towns', 'orders', 'checksums', 'longest wait', 'result'];
const rows = results.map(r => [
  r.scenario, r.land, r.map, r.first ? `${r.first.winner}, then ${r.winner}` : r.winner, r.time !== undefined ? (r.time / 60).toFixed(1) : '-',
  r.week ?? '-', r.towns.join('–'), r.orders.join('/'), r.agreed ?? '-', `${r.stall ?? 0} s`, r.problems.length ? 'PROBLEM' : 'ok',
]);
const width = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
const line = r => r.map((c, i) => String(c).padEnd(width[i])).join('  ');
console.log(`${results.length} matches, bots on both sides, up to ${MINS} game minutes each at ${SPEED}× speed, in ${((Date.now() - started) / 1000).toFixed(0)} s`);
console.log('(winner: by the host\'s screen, - if no one won in time; towns: host–guest at the end; orders carried out, host/guest;'
  + ' longest wait: the longest time neither side ran a turn)\n');
console.log(line(head));
for (const r of rows) console.log(line(r));
const bad = results.filter(r => r.problems.length);
for (const r of bad) console.log(`\n${r.scenario} on ${r.land} ${r.map}:\n  ${r.problems.join('\n  ')}`);
process.exitCode = bad.length ? 1 : 0;
