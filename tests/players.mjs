// Two players in one headless Chrome, for match.test.mjs and matches.mjs: each page has its own browser storage,
// like a separate machine, and plays through a relay from server/relay.mjs.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
export const SITE = fileURLToPath(new URL('../site/', import.meta.url));
export const LAPTOP = { width: 1200, height: 800 }, PHONE = { width: 390, height: 844, isMobile: true, hasTouch: true };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader', '--no-sandbox'] });

export const t = (page, fn, ...args) => page.evaluate((fn, args) => window.__t[fn](...args), fn, args);
// waits for fn (run in the page, with arg) to come true; generous, as CI machines draw in software and run slowly
export async function until(page, fn, what, ms = 20000, arg) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await page.evaluate(fn, arg)) return;
  throw new Error(`timed out waiting for ${what}`);
}
// a player: their own browser storage, like a separate machine. page.errors collects uncaught errors and, with
// consoleErrors, console.error messages too (an out-of-sync report is one)
// slow: how many times slower this player's machine runs (a slow phone)
export async function player(browser, srv, viewport, query = '', { slow = 1, consoleErrors = false } = {}) {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport(viewport);
  if (slow > 1) await page.emulateCPUThrottling(slow);
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  if (consoleErrors) page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('dialog', d => d.accept());   // Give up asks first
  await page.goto(`http://127.0.0.1:${srv.port}/?test${query}`);
  await page.waitForFunction(() => window.__t);
  return page;
}
// a host on a laptop and a guest on a phone, in a started match (River Valley, map 4821, unless given)
export async function pair(browser, srv, { land = 'valley', map = 4821, host: hq = '', guest: gq = '', slow = 1, consoleErrors = false } = {}) {
  const host = await player(browser, srv, LAPTOP, hq, { consoleErrors }), guest = await player(browser, srv, PHONE, gq, { slow, consoleErrors });
  await t(host, 'netHost', 'Ann');
  await until(host, () => __t.net().code, 'a room code');
  const { code } = await t(host, 'net');
  await t(guest, 'netJoin', code, 'Bo');
  await until(guest, () => __t.net().team === 1, 'the guest to join');
  await t(host, 'netStart', land, map);
  for (const p of [host, guest]) await until(p, () => __t.net().live, 'the match to start', 60000);
  return { host, guest, code };
}
export async function close(...pages) { for (const p of pages) await p.browserContext().close(); }
