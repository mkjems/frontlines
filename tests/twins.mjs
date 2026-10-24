// Two copies of the same battle side by side, the way two players' browsers will run it (docs/multiplayer.md).
// Both get the same map number, board and orders; they differ in everything that mustn't matter: window size
// (a laptop and a portrait phone), drawing, Math.random (which only looks and sound may use), and history:
// the first copy plays another battle before this one, as in a rematch. Both are
// stepped by hand, one game second at a time, and their checksums compared after every second.
// safari.mjs reuses the same setup and steps with one copy in Safari.

const URL_ = new URL('../site/index.html?test', import.meta.url).href;
export const MAP = 4821, BOARD = { w: 1200, h: 800 };
// the match both copies play: the settings that change the battle, fixed rather than read from each browser
export const MATCH = { ai: 1, difficulty: 'normal', classic: false, grace: 6 };
const WINDOWS = [{ width: 1200, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }];
// the same blue orders in both copies: armies from the capital towards the enemy's at these game seconds
export const ORDERS = { 5: 20, 60: 30, 150: 40, 300: 40, 450: 50 };

// These two run inside the page (they're sent to the browser as source, so they may only use their arguments).
export function setupInPage(land, map, board, match, history) {
  __t.freeze(); __t.board(board); __t.match(match);
  if (history) { __t.newMap('plateau', 77); __t.start(); __t.march('Ashford', 'Redmarsh', 30); __t.run(40); }
  __t.newMap(land, map); __t.start();
}
export function secondInPage(n) {
  if (n) __t.march('Ashford', 'Redmarsh', n);
  __t.run(1);
  if (__t.state() === 'upgrade') document.getElementById('choice0').click();
  return __t.snapshot();
}
// the parts of two snapshots that differ
export const differ = (ra, rb) => Object.keys(ra.parts).filter(k => ra.parts[k] !== rb.parts[k]);

async function copy(browser, land, viewport, history, url = URL_) {
  // each copy gets its own browser storage, like two machines; their saved settings don't matter, as the
  // match fixes everything that changes the battle
  const context = await browser.createBrowserContext(), page = await context.newPage();
  await page.setViewport(viewport);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__t);
  await page.evaluate(setupInPage, land, MAP, BOARD, MATCH, history);
  return page;
}
// one copy in Chrome, for safari.mjs: the laptop window, with history
export const chromeCopy = (browser, land, url) => copy(browser, land, WINDOWS[0], true, url);
export const chromeSecond = (page, s) => page.evaluate(secondInPage, ORDERS[s] || 0);

// Returns { first: { s, parts } | null, end: { s, a, b }, errors }: when and in which parts the copies first
// differed (null if never), and both copies' snapshots at the end.
export async function race(browser, land, secs) {
  const [a, b] = await Promise.all(WINDOWS.map((v, i) => copy(browser, land, v, i === 0)));
  let first = null, end = null;
  for (let s = 0; s < secs; s++) {   // a battle plays on behind the end dialog, so a lost game keeps going
    const [ra, rb] = await Promise.all([chromeSecond(a, s), chromeSecond(b, s)]);
    const diff = differ(ra, rb);
    if (diff.length && !first) first = { s: s + 1, parts: diff };
    end = { s: s + 1, a: ra, b: rb };
  }
  const errors = [...a.errors, ...b.errors];
  await a.browserContext().close(); await b.browserContext().close();
  return { first, end, errors };
}
