import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
export const OUT = process.env.OUT || new globalThis.URL('./out', import.meta.url).pathname;
fs.mkdirSync(OUT + '/stills', { recursive: true });
export const URL = 'http://localhost:' + (process.env.PORT || 8982) + '/e63334287a3deaa3/ironveil/';
export async function open(opts = {}) {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1366, height: 768 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: opts.dpr || 1 });
  await ctx.route(/analytics|firebase|googlesyndication|googletagmanager|\/stats\.js|adsbygoogle|doubleclick/, r => r.abort());
  // anything that is not this local server or a read-only library/font host is aborted (no database, stats or ads traffic)
  await ctx.route(u => { try { const h = new globalThis.URL(u).hostname; return !(h === 'localhost' || h === '127.0.0.1' || h === 'cdnjs.cloudflare.com' || /fonts\.(googleapis|gstatic)\.com$/.test(h)); } catch (e) { return false; } }, r => r.abort());
  // the game ships behind its preview gate (window.IV_PREVIEW = true, Boot Camp only). The bots need both missions, so
  // unless GATE=1 the test copy of the page is served with the gate open; the shipped file is not touched
  if (!process.env.GATE) await ctx.route(/\/ironveil\/(\?.*)?$|\/ironveil\/index\.html/, async r => { const res = await r.fetch(); const body = (await res.text()).replace('window.IV_PREVIEW = true;', 'window.IV_PREVIEW = false;'); await r.fulfill({ response: res, body }); });
  await ctx.addInitScript((init) => { try { localStorage.setItem('ironveil:terms', '1'); if (init) for (const k in init) localStorage.setItem(k, init[k]); } catch (e) {} }, opts.storage || null);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL + (opts.query || '?test'), { waitUntil: 'domcontentloaded' });
  return { browser, page, errors };
}
export async function waitState(page, st, ms = 120000) {
  await page.waitForFunction(s => window.__IV__ && window.__IV__.state() === s, st, { timeout: ms });
}
// screenshot with the loop running but the simulation frozen (timeScale 0)
export async function snap(page, path) {
  await page.evaluate(() => { __IV__.IV.timeScale = 0; __IV__.pauseLoop(false); });
  await page.waitForTimeout(1500);
  try { await page.screenshot({ path, timeout: 90000 }); } finally { await page.evaluate(() => { __IV__.pauseLoop(true); __IV__.IV.timeScale = 1; }); }
}
