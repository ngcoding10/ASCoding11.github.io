import fs from 'fs';
import { execSync } from 'child_process';
// HUD layout in first person: 1366x768 (mouse), 844x390 and 390x844 (touch). Overlaps between HUD boxes and touch
// buttons, and between the text HUD and the gun (FP.screenBox) or the centre of the screen.
import { open, waitState, OUT } from './lib.mjs';
const vps = JSON.parse(process.argv[2] || '[[1366,768,0],[844,390,1],[390,844,1]]');
const pre = process.argv[3] || 'fp1/hud';
for (const [w, h, touch] of vps) {
  const { browser, page, errors } = await open({ viewport: { width: w, height: h }, touch: !!touch, dpr: touch ? 2 : 1, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: {}, settings: { quality: 0 }, cp: null, tut: true }) } });
  await waitState(page, 'menu', 900000);
  await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
  if (touch && h > w) await page.evaluate(() => document.getElementById('portraitGo').click());
  const res = await page.evaluate(() => {
    __IV__.pauseLoop(true); const IV = __IV__.IV;
    for (let k = 0; k < 150; k++) __IV__.step(1);              // the sergeant's first line is up
    IV.hud.hint = { text: IV.t('Takedown'), key: IV.touch ? IV.t('Use') : IV.input.label('knife') };   // a prompt on screen too, keyed as the game keys it
    for (let k = 0; k < 20; k++) { __IV__.step(1); __IV__.render(); }
    const out = { gun: {}, overlaps: [], gunHits: [], centreHits: [], off: [] };
    const sel = '#obj, #wpn, #stance, #sub:not([hidden]), #prompt:not([hidden]), #touch .tb:not([hidden]), #tStick, #tTop';
    const els = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none');
    const rs = els.map(e => { const r = e.getBoundingClientRect(); return [e.dataset.t || e.id, r, !!e.closest('#touch')]; }).filter(r => r[1].width > 0);
    { const cw = Math.min(460, innerWidth * 0.5); rs.push(['compass', { left: (innerWidth - cw) / 2, right: (innerWidth + cw) / 2, top: 10, bottom: 36, width: cw }, false]); }   // drawn on the HUD canvas
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (hit(rs[i][1], rs[j][1]) && !(rs[i][0] === 'tTop' || rs[j][0] === 'tTop') ) out.overlaps.push(rs[i][0] + '/' + rs[j][0]);
    out.off = rs.filter(r => r[1].left < -1 || r[1].top < -1 || r[1].right > innerWidth + 1 || r[1].bottom > innerHeight + 1).map(r => r[0]);
    const cen = { left: innerWidth * 0.4, right: innerWidth * 0.6, top: innerHeight * 0.38, bottom: innerHeight * 0.62 };
    for (const k of ['smg', 'pistol', 'rifle']) {
      IV.weapons.equip(k); for (let n = 0; n < 30; n++) { __IV__.step(1); __IV__.render(); }
      const b = IV.fp.screenBox(); if (!b) continue;
      const gb = { left: b.x0 * innerWidth, right: b.x1 * innerWidth, top: b.y0 * innerHeight, bottom: b.y1 * innerHeight };
      // convex hull of the projected gun corners and hand/forearm points (the gun is a diagonal, its box is not)
      const P0 = b.pts.map(p => [p[0] * innerWidth, p[1] * innerHeight]).sort((a, c) => a[0] - c[0] || a[1] - c[1]);
      const cr = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
      const lo = [], hi = []; for (const p of P0) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (const p of P0.slice().reverse()) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
      const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
      const inHull = (x, y) => hull.every((p, i) => cr(p, hull[(i + 1) % hull.length], [x, y]) >= 0);
      const hitHull = r => { for (let x = r.left; x <= r.right; x += Math.max(2, (r.right - r.left) / 12)) for (let y = r.top; y <= r.bottom; y += Math.max(2, (r.bottom - r.top) / 6)) if (inHull(x, y)) return true; return false; };
      out.hull = out.hull || {}; out.hull[k] = hull.map(p => p.map(Math.round));
      out.gun[k] = [Math.round(gb.left), Math.round(gb.top), Math.round(gb.right), Math.round(gb.bottom)];
      for (const r of rs) if (!r[2] && hit(r[1], gb) && hitHull(r[1])) out.gunHits.push(k + ':' + r[0]);
    }
    for (const r of rs) if (!r[2] && hit(r[1], cen)) out.centreHits.push(r[0]);
    IV.weapons.equip('smg'); for (let n = 0; n < 30; n++) { __IV__.step(1); __IV__.render(); }
    // thumb reach: centre distance of Fire and Aim from the bottom-right corner, as a share of the screen height
    out.reach = {}; for (const r of rs) if (r[0] === 'fire' || r[0] === 'aim') { const c = [(r[1].left + r[1].right) / 2, (r[1].top + r[1].bottom) / 2]; out.reach[r[0]] = +(Math.hypot(innerWidth - c[0], innerHeight - c[1]) / innerHeight).toFixed(2); }
    out.rects = Object.fromEntries(rs.map(r => [r[0], [Math.round(r[1].left), Math.round(r[1].top), Math.round(r[1].right), Math.round(r[1].bottom)]]));
    return out;
  });
  await page.evaluate(() => { __IV__.render(); });   // the loop stays paused: the last frame stays on the canvas
  if (process.env.COMPOSE) {   // the WebGL canvas read back directly, the page (HUD, touch) shot without it, then layered
    const d = await page.evaluate(() => { __IV__.render(); return __IV__.IV.world.renderer.domElement.toDataURL('image/png'); });
    fs.writeFileSync(OUT + '/hud-gl.png', Buffer.from(d.split(',')[1], 'base64'));
    await page.evaluate(() => { const v = document.getElementById('view'); v.style.visibility = 'hidden'; for (let e = v; e; e = e.parentElement) e.style.background = 'transparent'; for (const e of document.querySelectorAll('.screen:not([hidden]), #fade')) e.style.background = 'transparent'; });
    await page.screenshot({ path: OUT + '/hud-dom.png', omitBackground: true, timeout: 200000 }).catch(e => console.log('dom snap failed', e.message.split('\n')[0]));
    execSync(`convert ${OUT}/hud-gl.png -resize ${w}x${h}! ${OUT}/hud-dom.png -composite -quality 88 ${OUT}/${pre}-${w}x${h}.jpg`);
  } else
  await page.screenshot({ path: OUT + `/${pre}-${w}x${h}.jpg`, type: 'jpeg', quality: 85, timeout: 200000, animations: 'disabled', scale: 'css' }).catch(e => console.log('snap failed', e.message));
  console.log(w + 'x' + h, JSON.stringify({ overlaps: res.overlaps, off: res.off, gunHits: res.gunHits, centreHits: res.centreHits, reach: res.reach, gun: res.gun, hull: res.hull }));
  console.log('  rects', JSON.stringify(res.rects));
  console.log('  errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
  await browser.close();
}
