// Ironwing (Arjun's air game) loads env/texgen.js, core.js and post.js from the Midnight Ops folder: it must still boot
// and draw through the post stack with this branch's versions of those files. argv[2] = quality (1 Medium, 2 High).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const q = +(process.argv[2] || 1), OUT = process.env.OUTDIR;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
await ctx.route(u => { try { const h = new URL(u).hostname; return !(h === 'localhost' || h === '127.0.0.1' || h === 'cdnjs.cloudflare.com' || /fonts\.(googleapis|gstatic)\.com$/.test(h)); } catch (e) { return false; } }, r => r.abort());
await ctx.addInitScript(() => { try { localStorage.setItem('ironwing:preview', '1'); localStorage.setItem('ironwing:terms', '1'); } catch (e) {} });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:' + process.env.PORT + '/e63334287a3deaa3/ironwing/?test&q=' + q, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__IW__ && window.__IW__.state() === 'menu', null, { timeout: 180000 });
await page.evaluate(() => { if (window.AutoRes) AutoRes.off(); });
await page.evaluate(() => __IW__.start('dawnstrike', 0));
await page.waitForFunction(() => window.__IW__.state() === 'play', null, { timeout: 600000 });
const r = await page.evaluate(() => { __IW__.pauseLoop(true); __IW__.step(30); for (let i = 0; i < 3; i++) __IW__.render(); const W = __IW__.IW.world; const c = W.renderer.domElement;
  return { state: __IW__.state(), post: !!W.post, postScale: W.post ? W.post.scale : null, hasSetCap: !!(W.post && W.post.setCap), canvas: [c.width, c.height], quality: __IW__.IW.S.quality, shot: c.toDataURL('image/jpeg', 0.85) }; });
fs.writeFileSync(OUT + `/ironwing-q${q}.jpg`, Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot;
console.log('ironwing', JSON.stringify(r));
const sh = errors.filter(e => /shader|WebGLProgram|compile|link|VALIDATE_STATUS/i.test(e));
console.log(sh.length ? 'FAIL shader errors: ' + sh.slice(0, 3).join('\n').slice(0, 600) : 'shader errors: none');
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n').slice(0, 1200) || 'none');
await browser.close();
