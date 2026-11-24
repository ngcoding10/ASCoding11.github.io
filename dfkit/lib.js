// Driftfall r128 -> r187 test library. Deterministic boot: seeded Math.random (three.js gets its own stream), virtual
// clocks (performance.now / Date.now), manual requestAnimationFrame, AutoRes held at 1. Only localhost, cdnjs and Google
// Fonts are reachable; every other request and every WebSocket is refused, so nothing reaches the database or the relay.
const { chromium } = require('playwright');
const fs = require('fs');
const ALLOW = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|https:\/\/cdnjs\.cloudflare\.com\/|https:\/\/fonts\.(googleapis|gstatic)\.com\/|data:|blob:)/;
// shared site scripts that talk to the network or only add noise: never loaded in these tests (same on both versions)
const SKIP = /\/analytics\/|\/stats\.js|\/elo\.js|\/gamechat\.js/;
const INIT = (seed) => {
  let s = seed, s3 = 99; const r3 = () => { s3 = s3 * 16807 % 2147483647; return s3 / 2147483647; };
  const isThree = () => { const L = Error.stackTraceLimit; Error.stackTraceLimit = 4; const st = new Error().stack; Error.stackTraceLimit = L;
    const ln = (st.split('\n')[3] || ''); return /three\.min\.js|\/lib\/three\//.test(ln); };
  Math.random = () => { if (isThree()) return r3(); s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // virtual clock: frames move it by 1/60 s; every call from the page's own code moves it 0.1 microsecond (so a loop that
  // waits on the clock still ends); calls from three.js do not move it
  let vt = 5000; const realNow = performance.now.bind(performance);
  performance.now = () => { if (!isThree()) vt += 1e-4; return vt; };
  window.__realNow = realNow;
  const T0 = Date.UTC(2026, 11, 5, 18, 0, 0); Date.now = () => T0 + Math.floor(vt);
  window.AutoRes = { scale: 1, off() {}, on() {} };
  // sound stays off: once a key press let the audio start, the sounds of many fast test frames piled up in real time and
  // the renderer ran out of memory (the test's doing, on r128 as on r187); the context is made but never resumed
  if (window.AudioContext) { AudioContext.prototype.resume = function () { return Promise.resolve(); }; const AC0 = window.AudioContext;
    window.AudioContext = window.webkitAudioContext = class extends AC0 { constructor(o) { super(o); try { super.suspend(); } catch (e) {} } }; }
  // r128 warns on every shadow pass for a skinned mesh drawn with a material without skinning (the Locker gliders): thousands
  // a second crashed the test page, so that one message is counted here instead of printed
  const cw = console.warn.bind(console); window.__skinWarn = 0;
  console.warn = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('THREE.WebGLShadowMap: THREE.SkinnedMesh with material.skinning set to false')) { window.__skinWarn++; return; } cw(...a); };
  const q = []; window.requestAnimationFrame = cb => { q.push(cb); return q.length; }; window.cancelAnimationFrame = () => {};
  window.__noRaf = false;
  // after each drawn frame, wait for the GPU (one pixel read): frames made back to back with no vsync otherwise queue up
  // in the renderer faster than software rendering drains them, and it ran out of memory
  const px = new Uint8Array(4); let gl = null;
  const sync = () => { if (window.__noRender) return; if (!gl) { const c = document.getElementById('view'); gl = c && (c.getContext('webgl2') || c.getContext('webgl')); } if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  window.__tick = (n = 1, ms = 1000 / 60) => { for (let i = 0; i < n; i++) { vt += ms; const c = q.splice(0); for (const f of c) { try { f(vt); } catch (e) { console.error('tick: ' + (e && e.stack || e)); } } sync(); } };
  window.__adv = (ms) => { vt += ms; };
  window.__tickD = (n = 1, ms = 1000 / 60) => { if (n > 1) { window.__noRender = true; window.__tick(n - 1, ms); window.__noRender = false; } window.__tick(1, ms); };   // n frames, only the last one drawn
};
async function launch() {
  return chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
    logger: process.env.DBG ? { isEnabled: n => n === 'browser', log: (n, sev, m) => { if (!/dbus|socket_posix|Floss|vaapi/.test(m)) console.log('BROWSER ' + m); } } : undefined });
}
// opts: port, w, h, touch, ls (localStorage), q (query), name, log(fn)
async function open(b, o) {
  const name = o.name || 'p', log = o.log || console.log;
  const ctx = await b.newContext({ viewport: { width: o.w || 1366, height: o.h || 768 }, hasTouch: !!o.touch, isMobile: !!o.touch, deviceScaleFactor: 1 });
  await ctx.route('**/*', r => { const u = r.request().url(); return ALLOW.test(u) && !SKIP.test(u) ? r.continue() : r.abort(); });
  await ctx.routeWebSocket(/.*/, ws => { log(`[${name}] websocket refused ${ws.url()}`); ws.close(); });
  const p = await ctx.newPage(); p.errs = []; p.warns = [];
  p.on('console', m => { const t = m.type(), x = m.text(); if (t === 'error' || t === 'warning' || /THREE|patch/i.test(x)) { if (/Failed to load resource|ERR_FAILED|ERR_BLOCKED|net::/.test(x)) return; (t === 'error' ? p.errs : p.warns).push(x.slice(0, 600)); log(`[${name}] console.${t}: ${x.slice(0, 600)}`); } });
  p.on('pageerror', e => { p.errs.push('PAGEERROR ' + e.message); log(`[${name}] PAGEERROR: ${e.message}`); });
  await p.addInitScript(INIT, o.seed || 777);
  if (o.init) await p.addInitScript(o.init);
  await p.addInitScript(ls => { for (const k in ls) localStorage.setItem(k, ls[k]); }, Object.assign({ 'event:turkey:off': '1', 'driftfall:name': 'Tester', 'driftfall:col': '#ff6a3a' }, o.ls || {}));
  p.setDefaultTimeout(300000);
  const t0 = Date.now();
  await p.goto(`http://localhost:${o.port}/e63334287a3deaa3/drop-zone/${o.q || '?event=none'}`, { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => !!window.__dz, null, { timeout: 300000 });
  await p.evaluate(() => __tick(3));
  log(`[${name}] booted in ${((Date.now() - t0) / 1000).toFixed(0)}s, THREE ${await p.evaluate(() => THREE.REVISION + (THREE.R128_COMPAT ? ' compat' : ''))}`);
  return p;
}
// renderer.info for one renderOnce (shadow pass included) plus programs
async function info(p) {
  return p.evaluate(() => { const R = __dz.renderer; R.info.autoReset = false; R.info.reset(); __dz.renderOnce(); const i = R.info; R.info.autoReset = true;
    return { calls: i.render.calls, tris: i.render.triangles, pts: i.render.points, lines: i.render.lines, programs: (i.programs || []).length, geos: i.memory.geometries, texs: i.memory.textures, tier: __dz.lookKey, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1 }; });
}
// canvas still (no HTML HUD): render then read in the same task
async function canvasShot(p, file) {
  const u = await p.evaluate(() => { __dz.renderOnce(); return __dz.renderer.domElement.toDataURL('image/png'); });
  fs.writeFileSync(file, Buffer.from(u.split(',')[1], 'base64'));
}
module.exports = { launch, open, info, canvasShot, ALLOW };
