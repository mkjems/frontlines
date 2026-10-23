// Two copies of the same battle side by side, the way two players' browsers will run it (docs/multiplayer.md).
// Both get the same map number, board and orders; they differ in everything that mustn't matter: window size
// (a laptop and a portrait phone), drawing, Math.random (which only looks and sound may use), and history:
// the first copy plays another battle before this one, as in a rematch. Both are
// stepped by hand, one game second at a time, and their checksums compared after every second.

const URL_ = new URL('../site/index.html?test', import.meta.url).href;
const MAP = 4821, BOARD = { w: 1200, h: 800 };
const WINDOWS = [{ width: 1200, height: 800 }, { width: 390, height: 844, isMobile: true, hasTouch: true }];
// the same blue orders in both copies: armies from the capital towards the enemy's at these game seconds
const ORDERS = { 5: 20, 60: 30, 150: 40, 300: 40, 450: 50 };

async function copy(browser, land, viewport, history) {
  // each copy gets its own browser storage, like two machines, with the same saved settings (the tutorial
  // done): settings that change the battle must match, see phase 3 of docs/multiplayer.md
  const context = await browser.createBrowserContext(), page = await context.newPage();
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('frontlines-tutorial', 'done'); } catch (e) {} });
  await page.setViewport(viewport);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(URL_);
  await page.waitForFunction(() => window.__t);
  await page.evaluate((land, map, board, history) => {
    __t.freeze(); __t.board(board);
    if (history) { __t.newMap('marsh', 77); __t.start(); __t.march('Ashford', 'Redmarsh', 30); __t.run(40); }
    __t.newMap(land, map); __t.start();
  }, land, MAP, BOARD, history);
  return page;
}

function second(page, s) {
  return page.evaluate(n => {
    if (n) __t.march('Ashford', 'Redmarsh', n);
    __t.run(1);
    if (__t.state() === 'upgrade') document.getElementById('choice0').click();
    return __t.snapshot();
  }, ORDERS[s] || 0);
}

// Returns { first: { s, parts } | null, end: { s, a, b }, errors }: when and in which parts the copies first
// differed (null if never), and both copies' snapshots at the end.
export async function race(browser, land, secs) {
  const [a, b] = await Promise.all(WINDOWS.map((v, i) => copy(browser, land, v, i === 0)));
  let first = null, end = null;
  for (let s = 0; s < secs; s++) {   // a battle plays on behind the end dialog, so a lost game keeps going
    const [ra, rb] = await Promise.all([second(a, s), second(b, s)]);
    const diff = Object.keys(ra.parts).filter(k => ra.parts[k] !== rb.parts[k]);
    if (diff.length && !first) first = { s: s + 1, parts: diff };
    end = { s: s + 1, a: ra, b: rb };
  }
  const errors = [...a.errors, ...b.errors];
  await a.browserContext().close(); await b.browserContext().close();
  return { first, end, errors };
}
