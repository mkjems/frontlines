// The computer against the computer (docs/ideas.md): both sides played by the AI, many games at full speed, to
// measure the game's balance instead of guessing it. Each game is one landscape and map number, and the battle is
// deterministic, so a game can be played again exactly (?land=…&map=…). Not part of `npm test`.
//
//   npm run balance                                  every landscape, 20 maps each, the usual computer on both sides
//   npm run balance -- --land valley --games 50      one landscape (or several: valley,lake), 50 maps
//   npm run balance -- --a farms --b even            two ways of spending gold against each other (BUY_ORDERS)
//   npm run balance -- --a even+fast --b even        a style with +fast acts as fast as it likes (match.fast)
//   npm run balance -- --mins 30 --diff normal       games stopped after 30 minutes; the computer's normal rules
//   npm run balance -- --player --diff easy          a stand-in for the player against the computer on easy
//                                                    (--a: the stand-in's style, --b: the computer's)
//
// With the same style on both sides it reports wins per side: the maps are mirrored, so a big gap means one side
// is favoured by something other than the map. With two styles, each map is played twice, the sides swapped, and
// it reports wins per style. With --player, the computer also plays the person's side by the person's rules
// (match.standin: their training, income, tray and weekly choice), each map from both sides, so the stand-in's
// wins against each difficulty measure how hard it is. Also: games that ran out of time, how long games last, how often the side ahead in
// towns changed, and comebacks: games won by the side that had once been behind by 3 or more towns.

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import puppeteer from 'puppeteer-core';

const LANDS = ['valley', 'lake', 'tworivers', 'mountains', 'open', 'steppe', 'greenwood', 'highlands', 'plateau', 'broken'];
const { values: opt } = parseArgs({ options: {
  land: { type: 'string', default: 'all' }, games: { type: 'string', default: '20' }, mins: { type: 'string', default: '20' },
  diff: { type: 'string', default: 'hard' }, a: { type: 'string', default: 'even' }, b: { type: 'string', default: '' },
  player: { type: 'boolean', default: false },
} });
const lands = opt.land === 'all' ? LANDS : opt.land.split(','), GAMES = +opt.games, MINS = +opt.mins;
const A = opt.a, B = opt.b || opt.a, versus = A !== B, PAGES = 4, SAMPLE = 15;
const URL_ = new URL('../site/index.html?test', import.meta.url).href;
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);

// one game, inside the page: played until a capital falls or time runs out, with the sides' standing every SAMPLE s
function playInPage(land, map, match, secs, sample) {
  __t.freeze(); __t.board({ w: 1200, h: 800 }); __t.match(match);
  __t.newMap(land, map); __t.start();
  const timeline = [];
  let w = __t.war();
  while (w.winner < 0 && w.time < secs) {
    __t.run(sample);
    w = __t.war();
    timeline.push(w.sides.map(s => [s.towns, s.soldiers]));
  }
  return { land, map, winner: w.winner, time: w.time, week: w.week, sides: w.sides, timeline };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });
const pages = await Promise.all(Array.from({ length: PAGES }, async () => {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 1200, height: 800 });
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__t);
  return page;
}));

// each map's games: who plays each team (labels, the columns of wins), the computer's team, and the styles by team
const sideups = opt.player ? [1, 0].map(ai => ({ ai, labels: ai ? ['player', 'computer'] : ['computer', 'player'], buys: ai ? [A, B] : [B, A] }))
  : versus ? [{ ai: 2, labels: [A, B], buys: [A, B] }, { ai: 2, labels: [B, A], buys: [B, A] }]
  : [{ ai: 2, labels: ['blue', 'red'], buys: [A, A] }];
const col = sideups[0].labels;
const jobs = lands.flatMap(land => Array.from({ length: GAMES }, (_, i) => sideups.map(up => ({ land, map: i + 1, ...up }))).flat());
const games = [];
const started = Date.now();
await Promise.all(pages.map(async page => {
  for (let job; (job = jobs.shift());) {
    const match = { ai: job.ai, standin: opt.player, difficulty: opt.diff, classic: false, grace: 6,
      buys: job.buys.map(b => b.split('+')[0]), fast: job.buys.map(b => b.endsWith('+fast')) };
    games.push({ ...await page.evaluate(playInPage, job.land, job.map, match, MINS * 60, SAMPLE), labels: job.labels });
  }
}));
const errors = [...new Set(pages.flatMap(p => p.errors))];
await browser.close();

// the team that played a column in a game
const teamOf = (g, c) => g.labels.indexOf(col[c]);
// how often the side ahead in towns changed, and whether the winner had been behind by 3 or more towns
function story(g) {
  let leader = 0, changes = 0, worst = 0;
  for (const [a, b] of g.timeline) {
    const d = a[0] - b[0], now = Math.sign(d);
    if (now && leader && now !== leader) changes++;
    if (now) leader = now;
    if (g.winner >= 0) worst = Math.max(worst, g.winner === 0 ? -d : d);
  }
  return { changes, comeback: worst >= 3 };
}
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '-';

const rows = [...lands, 'all'].map(land => {
  const gs = games.filter(g => land === 'all' || g.land === land), done = gs.filter(g => g.winner >= 0), st = gs.map(story);
  return [
    land, gs.length, ...[0, 1].map(c => pct(gs.filter(g => g.winner >= 0 && g.winner === teamOf(g, c)).length, gs.length)),
    pct(gs.length - done.length, gs.length), done.length ? (median(done.map(g => g.time)) / 60).toFixed(1) : '-',
    done.length ? median(done.map(g => g.week)) : '-', (st.reduce((n, s) => n + s.changes, 0) / gs.length).toFixed(1),
    pct(st.filter(s => s.comeback).length, done.length),
  ];
});
const head = ['landscape', 'games', ...col, 'timeout', 'minutes', 'week', 'lead changes', 'comebacks'];
const width = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
const line = r => r.map((c, i) => (i ? String(c).padStart(width[i]) : String(c).padEnd(width[i]))).join('  ');
const who = opt.player ? `a stand-in for the player${A !== 'even' ? ` (${A})` : ''} against the computer${B !== 'even' ? ` (${B})` : ''}, each map from both sides`
  : versus ? `buying ${A} against ${B}, each map from both sides` : `both sides buying ${A}`;
console.log(`${games.length} games on ${opt.diff}, ${who}, up to ${MINS} minutes each, in ${((Date.now() - started) / 1000).toFixed(0)} s`);
// chance alone moves a win share by up to about twice its standard error, 100 / √games percent at even odds
const margin = n => Math.round(100 / Math.sqrt(n));
console.log(`(minutes and week: the median of decided games. By chance alone a share can be off by about ±${margin(GAMES * sideups.length)}% for one`
  + ` landscape, ±${margin(games.length)}% for all)\n`);
console.log(line(head));
for (const r of rows) console.log(line(r));

// what the winners and losers had at the end, over all decided games
const decided = games.filter(g => g.winner >= 0), avg = (f) => decided.reduce((n, g) => n + f(g), 0) / (decided.length || 1);
if (decided.length) {
  const end = who => {
    const side = g => g.sides[who === 'winners' ? g.winner : 1 - g.winner];
    const kinds = [0, 1, 2].map(k => avg(g => side(g).kinds[k]).toFixed(0)).join('/');
    const bought = ['farm', 'tower', 'barracks'].map(k => avg(g => side(g).bought[k] || 0).toFixed(1)).join('/');
    return `${who.padEnd(8)} soldiers left (spears/archers/cavalry) ${kinds}; bought farms/towers/barracks ${bought}`;
  };
  console.log(`\nAt the end of decided games, on average:\n${end('winners')}\n${end('losers')}`);
}
// the computer's pace, per column: orders that changed something (a route, a troop type, an army sent on, a
// purchase) per minute, and the most within 10 s; a person manages perhaps one every second or two
for (const label of new Set(col)) {
  const sides = games.flatMap(g => g.sides.filter((s, team) => g.labels[team] === label).map(s => ({ ...s, mins: g.time / 60 })));
  console.log(`\nPace of ${label}: ${(sides.reduce((n, s) => n + s.acts, 0) / sides.reduce((n, s) => n + s.mins, 0)).toFixed(0)} orders a minute;`
    + ` the most within 10 s ${median(sides.map(s => s.burst))} in a typical game, ${Math.max(...sides.map(s => s.burst))} at most`);
}
const timeouts = games.filter(g => g.winner < 0);
if (timeouts.length) console.log(`\nOut of time: ${timeouts.map(g => `${g.land} ${g.map} (${g.sides.map(s => s.towns).join('–')} towns)`).join(', ')}`);
if (errors.length) console.log(`\nPage errors: ${errors.join(' | ')}`);
process.exitCode = errors.length ? 1 : 0;
