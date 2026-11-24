// Driftfall graphics pass: the 10 fixed moments (+ low-tier and phone views, numbers, a timed render).
// node cap10.js <port> <outdir> [groups,comma]   groups: hi, lo, phone, perf
const { launch, open, info, canvasShot } = require('./lib');
const fs = require('fs');
const [PORT, OUT, ONLYS] = process.argv.slice(2); const ONLY = (ONLYS || 'hi,lo,phone').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const log = [], INFO = {};
const out = s => { console.log(s); log.push(s); };

const HELP = () => {
  const D = __dz; window.T = {};
  T.adv = (sec, ms = 50) => { const n = Math.round(sec * 1000 / ms); window.__noRender = true; __tick(n, ms); window.__noRender = false; };
  T.cam = (pos, look, fov) => { const c = D.camera; c.fov = fov || 60; c.near = .15; c.far = 800; c.position.set(...pos); c.lookAt(...look); c.updateProjectionMatrix(); };
  T.place = (e, x, z, yaw, o = {}) => {
    const y = o.y != null ? o.y : D.groundAt(x, z, 200);
    e.present = true; e.alive = true; e.hittable = true; e.pos.set(x, y, z); e.yaw = yaw; e.pitch = o.pitch || 0;
    e.vel.set(0, 0, 0); e.st = o.st || 'ground'; e.glide = e.st === 'glide'; e.onGround = e.st === 'ground'; e.float = !e.onGround;
    if (o.held) { const i = e.inv.findIndex(s => s && s.t === o.held); if (i >= 0) D.selectSlot(e, i); else { e.inv[0] = { t: o.held, r: 2, n: 30 }; D.selectSlot(e, 0); } }
    for (let i = 0; i < (o.n == null ? 30 : o.n); i++) D.animModel(e, 1 / 60);
    e.model.visible = true;
  };
  T.hideBots = (keep = []) => { for (const e of D.bots.values()) if (!keep.includes(e)) { e.present = false; e.model.visible = false; e.pos.set(5, -50, 5); } };
  // fixed views, worked out from the map so they are the same on both versions
  T.views = () => {
    const M = D.mapSize; let hb = [0, -1e9, 0];
    for (let x = 10; x < M - 10; x += 3) for (let z = 10; z < M - 10; z += 3) { const h = D.terrainH(x, z); if (h > hb[1]) hb = [x, h, z]; }
    // inside: the largest footprint with a floor and a roof over its middle
    let ins = null, best = 0;
    for (const f of D.footprints) { const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2, th = D.terrainH(cx, cz), fl = D.groundAt(cx, cz, th + 2.2), rf = D.groundAt(cx, cz, 200), a = (f.x1 - f.x0) * (f.z1 - f.z0);
      if (rf > fl + 2.6 && Math.abs(fl - th) < 2 && a > best && a < 1400) { best = a; ins = [f.x0 + 1.4, fl + 1.6, f.z0 + 1.4, f.x1 - 2, fl + 1.2, f.z1 - 2]; } }
    // shore: walk out from the centre to the south-west until the land drops under 0.6 m
    let sh = null; const a = 2.5, dx = Math.sin(a), dz = Math.cos(a);
    for (let r = 20; r < 200; r += .5) { const x = M / 2 + dx * r, z = M / 2 + dz * r; if (D.terrainH(x, z) < .6) { sh = [x - dx * 2, z - dz * 2]; break; } }
    return { hill: hb, ins, sh, M };
  };
};

async function shot(p, name, setup, opts = {}) {
  if (setup) await p.evaluate(setup, opts.arg);
  const i = await info(p);
  if (opts.page) { await p.evaluate(() => __dz.renderOnce()); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 300000 }); }
  else await canvasShot(p, `${OUT}/${name}.png`);
  INFO[name] = i; out(`${name} ${JSON.stringify(i)}`);
}
async function boot(b, name, o = {}) { const p = await open(b, Object.assign({ port: PORT, name, log: out }, o)); await p.evaluate(HELP); return p; }
async function toBus(p) {
  await p.evaluate(() => __dz.startPractice());
  await p.evaluate(() => { let i = 0; while (!(__dz.bots.size === 11 && __dz.player.st === 'bus' && __dz.matchT() > 3) && i++ < 2000) T.adv(.05); });
}
async function dropAndLand(p, cb) {
  await p.evaluate(() => { __dz.dropFromBus(__dz.player); __tickD(4, 50); });
  await p.evaluate(() => __tickD(20, 50));
  await p.keyboard.down('Space'); await p.evaluate(() => __tickD(2, 50)); await p.keyboard.up('Space'); await p.evaluate(() => __tickD(18, 50));
  if (cb) await cb('glide');
  await p.evaluate(() => { const D = __dz, P = D.player; P.pos.y = Math.min(P.pos.y, D.groundAt(P.pos.x, P.pos.z, 200) + 2.5); let i = 0; window.__noRender = true; while (P.st !== 'ground' && i++ < 400) __tickD(1, 50); window.__noRender = false; __tickD(2, 50); });
  if (cb) await cb('land');
}
// timed render of the current view: n renders, median ms
async function timed(p, name, n = 12) {
  const r = await p.evaluate(n => { const t = []; const gl = __dz.renderer.getContext(), px = new Uint8Array(4);
    for (let i = 0; i < n; i++) { const a = __realNow(); __dz.renderOnce(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); t.push(__realNow() - a); }
    t.sort((a, b) => a - b); return { med: +t[n >> 1].toFixed(1), min: +t[0].toFixed(1) }; }, n);
  out(`TIME ${name} ${JSON.stringify(r)}`); return r;
}
async function rtMem(p) {
  return p.evaluate(() => { let tx = 0; const R = __dz.renderer; return { texs: R.info.memory.textures, geos: R.info.memory.geometries, px: R.getPixelRatio() }; });
}

// the scenery views (camera fixed); tier set by the caller
const VIEWS = {
  m03_hill: () => { const v = T.views(), h = v.hill; T.hideBots(); __dz.player.model.visible = false; T.cam([h[0], h[1] + 2.4, h[2]], [v.M / 2, 4, v.M / 2], 60); },
  m04_town: () => { const D = __dz, q = D.places.find(q => /Pinecone/.test(q.name || q.n)) || D.places[2]; const x = q.x, z = q.z, ang = 2 * 1.7, dist = 30, cx = x + Math.sin(ang) * dist, cz = z + Math.cos(ang) * dist; T.cam([cx, D.groundAt(cx, cz, 200) + 2.2, cz], [x, D.groundAt(x, z, 200) + 1.5, z], 60); },
  m05_inside: () => { const v = T.views(), a = v.ins; window.__ins = a; T.cam([a[0], a[1], a[2]], [a[3], a[4], a[5]], 70); },
  m08_shore: () => { const D = __dz, v = T.views(), s = v.sh; const h = Math.max(0, D.terrainH(s[0], s[1])); T.cam([s[0], h + 1.8, s[1]], [s[0] + 30 * Math.cos(2.5), 0.3, s[1] - 30 * Math.sin(2.5)], 60); window.__sh = s; },
  m11_island: () => { T.cam([-60, 140, 300], [120, 0, 120], 55); },
};

const G = {
  async hi(b) {
    const p = await boot(b, 'hi');
    await toBus(p);
    await dropAndLand(p, async k => { if (k === 'glide') await shot(p, 'm01_drop'); else await shot(p, 'm02_land'); });
    await p.evaluate(() => { T.hideBots(); __dz.player.model.visible = false; });
    out('views ' + JSON.stringify(await p.evaluate(() => T.views())));
    for (const [n, f] of Object.entries(VIEWS)) await shot(p, n, f);
    // a player hiding in the room's far corner, seen from the doorway side (for readability indoors)
    await shot(p, 'm05b_corner', () => { const D = __dz, v = T.views(), a = v.ins, bt = [...D.bots.values()][3]; const dx = a[3] - a[0], dz = a[5] - a[2], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L; T.place(bt, a[0] + ux * 6 + uz * 1.6, a[2] + uz * 6 - ux * 1.6, Math.atan2(ux, uz), { held: 'ar' }); T.cam([a[0], a[1], a[2]], [a[3], a[4], a[5]], 70); });
    await p.evaluate(() => T.hideBots());
    if (!process.env.NOT2) await shot(p, 'm04_town_t2', () => { __dz.fxTier = 2; T.views(); }); if (!process.env.NOT2) { await p.evaluate(VIEWS.m04_town); await shot(p, 'm04_town_t2', () => {}); await p.evaluate(() => { __dz.fxTier = 1; }); }
    await timed(p, 'hi_town', 10).catch(e => out('time fail ' + e.message));
    // build fight
    await p.evaluate(() => { const D = __dz, P = D.player; P.model.visible = true; D.teleport(118, 151); P.yaw = 0; P.pitch = -.05; D.give('ar', 3); });
    await p.evaluate(() => { const D = __dz, cx = Math.floor(118 / 4), cz = Math.floor(151 / 4) - 3;
      D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx, z: cz, L: 1 }), null, true, 'me'); D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx + 1, z: cz, L: 1 }), null, true, 'me');
      D.tryBuild(D.landFit({ kind: 'ramp', x: cx - 1, z: cz, L: 1, dir: 0 }, true), null, true, 'me');
      const w = [...D.pieces.values()][0]; if (w) D.editPiece(w, 18, true);
      const bs = [...D.bots.values()]; T.place(bs[5], 121, 140, Math.PI, { held: 'ar' }); T.place(bs[6], 115, 142, Math.PI * .9, { held: 'sg' }); __tick(4, 50); });
    await shot(p, 'm06_fight', () => { const D = __dz, bt = [...D.bots.values()][5]; window.__noRender = true; D.aimAt(bt); D.fire(); __tick(1, 16); D.fire(); __tick(2, 16); window.__noRender = false; });
    await timed(p, 'hi_fight', 10).catch(e => out('time fail ' + e.message));
    await p.evaluate(() => { const D = __dz, P = D.player; P.hp = 1e6; window.__noRender = true; let i = 0; while (D.matchT() < 160 && i++ < 5000) { __tick(1, 100); P.hp = 100; P.alive = true; } window.__noRender = false; });
    await shot(p, 'm07_storm', () => { const D = __dz, s = D.stormAt(D.matchT()); const cx = s.x || s.cx || 120, cz = s.z || s.cz || 120, r = s.r || 60; T.hideBots(); __dz.player.model.visible = false; __tick(1, 50); T.cam([cx, 14, cz + r - 22], [cx + 10, 10, cz + r + 40], 60); });
    await p.evaluate(() => { const D = __dz, P = D.player, bs = [...D.bots.values()].filter(b => b.alive); D.die(P, bs[0] && bs[0].id, 'ar'); window.__noRender = true; __tick(60, 50); window.__noRender = false; });
    await shot(p, 'e01_end', null, { page: true });
    out(`[hi] errors ${p.errs.length} warnings ${p.warns.length} ${JSON.stringify(p.errs.slice(0, 4))} ${JSON.stringify(p.warns.slice(0, 4))}`);
    await p.context().close();
    // the Locker
    const q = await boot(b, 'lock', { q: '?event=none&locker=1', ls: { 'driftfall:lx': 'g3t2w5b2p3', 'driftfall:skin': '7' } });
    await q.waitForFunction(() => !!__dz.LX, null, { timeout: 120000 }).catch(() => out('LX not loaded'));
    await q.evaluate(() => { __tick(20); const x = document.getElementById('lockerBtn'); if (x) x.click(); __tick(30); });
    await shot(q, 'm09_locker', () => __tick(30), { page: true });
    out(`[lock] errors ${q.errs.length} warnings ${q.warns.length}`);
    await q.context().close();
  },
  async fx(b) {
    const p = await boot(b, 'fx');
    await toBus(p); await dropAndLand(p);
    await p.evaluate(() => { T.hideBots(); const D = __dz, P = D.player; P.model.visible = false; D.teleport(118, 151); });
    // rare loot on open ground, seen from 28 m
    await shot(p, 'f1_loot', () => { const D = __dz; let k = 0; for (const [dx, dz, r] of [[-6, -14, 4], [0, -18, 3], [6, -13, 2], [3, -8, 1], [-3, -22, 0]]) D.addItem({ id: 'fxl' + (k++), t: 'ar', r, x: 118 + dx, z: 151 + dz });
      __tick(3, 50); const y = D.groundAt(118, 162, 200); T.cam([118, y + 4, 162], [118, y, 136], 60); });
    // a knockout a moment ago, 8 m away
    await shot(p, 'f2_ko', () => { const D = __dz, bt = [...D.bots.values()][2], y = D.groundAt(118, 140, 200); T.place(bt, 118, 140, 0); D.die(bt, D.player.id, 'ar'); __tick(5, 50);
      T.cam([118, y + 2, 149], [118, y + 2.5, 138], 60); });
    // a wall being placed close by
    await shot(p, 'f3_build', () => { const D = __dz, cx = Math.floor(126 / 4), cz = Math.floor(150 / 4); D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx, z: cz, L: 1 }), D.player, false, 'me'); __tick(4, 50);
      const y = D.groundAt(128, 156, 200); T.cam([128, y + 1.8, 157], [128, y + 1.2, 150], 60); });
    // the storm's edge on the ground, from inside the circle
    await p.evaluate(() => { const D = __dz, P = D.player; window.__noRender = true; let i = 0; while (D.matchT() < 160 && i++ < 5000) { __tick(1, 100); P.hp = 100; P.alive = true; } window.__noRender = false; });
    await shot(p, 'f4_edge', () => { const D = __dz, s = D.stormAt(D.matchT()); T.hideBots(); __tick(1, 50); const a = .6, ex = s.x + Math.sin(a) * (s.r - 9), ez = s.z + Math.cos(a) * (s.r - 9), y = D.groundAt(ex, ez, 200);
      T.cam([ex, y + 3, ez], [s.x + Math.sin(a + .25) * s.r, y, s.z + Math.cos(a + .25) * s.r], 60); });
    out(`[fx] errors ${p.errs.length} warnings ${p.warns.length} ${JSON.stringify(p.errs.slice(0, 4))}`);
    await p.context().close();
  },
  async lo(b) {
    const p = await boot(b, 'lo', { ls: { 'driftfall:gfx': 'fast' } });
    await toBus(p);
    await dropAndLand(p, async k => { if (k === 'glide') await shot(p, 'lo_m01_drop'); });
    await p.evaluate(() => { T.hideBots(); __dz.player.model.visible = false; });
    for (const n of ['m04_town', 'm08_shore', 'm11_island']) await shot(p, 'lo_' + n, VIEWS[n]);
    await p.evaluate(VIEWS.m04_town); await timed(p, 'lo_town', 10).catch(e => out('time fail ' + e.message));
    out(`[lo] errors ${p.errs.length} warnings ${p.warns.length} ${JSON.stringify(p.errs.slice(0, 4))}`);
    await p.context().close();
  },
  async phone(b) {
    for (const [w, h] of [[844, 390], [390, 844]]) {
      const p = await boot(b, 'ph' + w, { w, h, touch: true });
      await toBus(p); await dropAndLand(p);
      await p.evaluate(() => { __dz.give('ar', 2); __tick(10, 50); });
      await shot(p, `m10_phone${w}`, null, { page: true });
      out(`[ph${w}] errors ${p.errs.length} warnings ${p.warns.length}`);
      await p.context().close();
    }
  },
};
(async () => {
  const b = await launch(); const t0 = Date.now();
  for (const g of Object.keys(G)) { if (!ONLY.includes(g)) continue; const t = Date.now(); try { await G[g](b); } catch (e) { out(`GROUP ${g} FAILED: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); } out(`group ${g} ${((Date.now() - t) / 1000).toFixed(0)}s`);
    fs.writeFileSync(OUT + '/log-' + ONLY.join('_') + '.txt', log.join('\n') + '\n'); fs.writeFileSync(OUT + '/info-' + ONLY.join('_') + '.json', JSON.stringify(INFO, null, 1)); }
  await b.close();
  out(`total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  fs.writeFileSync(OUT + '/log-' + ONLY.join('_') + '.txt', log.join('\n') + '\n');
})();
