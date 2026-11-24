// Driftfall stills + console + renderer.info at fixed, repeatable states.  node cap.js <port> <outdir> [groups,comma]
// groups: desk (Pretty, every look tier), fast (Fast set at load), lock (the Locker and its extras), phone (two sizes, touch)
const { launch, open, info, canvasShot } = require('./lib');
const fs = require('fs');
const [PORT, OUT, ONLYS] = process.argv.slice(2); const ONLY = (ONLYS || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const log = [], INFO = {};
const out = s => { console.log(s); log.push(s); };

// page-side helpers
const HELP = () => {
  const D = __dz; window.T = {};
  T.ents = () => [D.player, ...D.bots.values()];
  T.adv = (sec, ms = 50) => { const n = Math.round(sec * 1000 / ms); window.__noRender = true; __tick(n, ms); window.__noRender = false; };
  T.cam = (pos, look, fov) => { const c = D.camera; c.fov = fov || 60; c.near = .15; c.far = 800; c.position.set(...pos); c.lookAt(...look); c.updateProjectionMatrix(); };
  // freeze the camera where T.cam put it: updateCamera is called by frame(); while __camLock is set, ticks leave it alone
  T.place = (e, x, z, yaw, o = {}) => {
    const y = o.y != null ? o.y : D.groundAt(x, z, 200);
    e.present = true; e.alive = true; e.hittable = true; e.pos.set(x, y, z); e.yaw = yaw; e.pitch = o.pitch || 0;
    e.vel.set(0, 0, 0); e.st = o.st || 'ground'; e.glide = e.st === 'glide'; e.onGround = e.st === 'ground'; e.float = !e.onGround;
    if (o.held) { const i = e.inv.findIndex(s => s && s.t === o.held); if (i >= 0) D.selectSlot(e, i); else { e.inv[0] = { t: o.held, r: 2, n: 30 }; D.selectSlot(e, 0); } }
    for (let i = 0; i < (o.n == null ? 30 : o.n); i++) D.animModel(e, 1 / 60);
    e.model.visible = true;
  };
  T.hideBots = (keep = []) => { for (const e of D.bots.values()) if (!keep.includes(e)) { e.present = false; e.model.visible = false; e.pos.set(5, -50, 5); } };
  T.placeXZ = (n) => { const p = D.places.find(q => (q.name || q.n) === n) || D.places[0]; return [p.x, p.z]; };
};

async function shot(p, name, setup, opts = {}) {
  if (setup) await p.evaluate(setup, opts.arg);
  const i = await info(p);
  if (opts.page) { await p.evaluate(() => __dz.renderOnce()); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 300000 }); }
  else await canvasShot(p, `${OUT}/${name}.png`);
  INFO[name] = i; out(`${name} ${JSON.stringify(i)}`);
}
// (tiers() needs the tier set before info/render: do it explicitly)
async function tierShots(p, name, setup, list = [1, 0, 2], arg) {
  if (setup) await p.evaluate(setup, arg);
  for (const t of list) { await p.evaluate(t2 => { __dz.fxTier = t2; }, t); await shot(p, `${name}_t${t}`); }
  await p.evaluate(() => { __dz.fxTier = 1; });
}

async function boot(b, name, o = {}) {
  const p = await open(b, Object.assign({ port: PORT, name, log: out }, o));
  await p.evaluate(HELP);
  return p;
}
// start Practice and run (unrendered) until the Drifter is flying with everyone aboard
async function toBus(p) {
  await p.evaluate(() => __dz.startPractice());
  await p.evaluate(() => { let i = 0; while (!(__dz.bots.size === 11 && __dz.player.st === 'bus' && __dz.matchT() > 3) && i++ < 2000) T.adv(.05); });
  out('bus: ' + JSON.stringify(await p.evaluate(() => ({ st: __dz.player.st, bots: __dz.bots.size, t: +__dz.matchT().toFixed(2), state: __dz.state }))));
}
// the player drops, falls, glides and lands (real key presses for the glider); bots are left to themselves
async function dropAndLand(p, cb) {
  await p.evaluate(() => { __dz.dropFromBus(__dz.player); __tickD(4, 50); });
  if (cb) await cb('jump');
  await p.evaluate(() => __tickD(20, 50)); if (cb) await cb('fall');
  await p.keyboard.down('Space'); await p.evaluate(() => __tickD(2, 50)); await p.keyboard.up('Space'); await p.evaluate(() => __tickD(18, 50));
  if (cb) await cb('glide');
  await p.evaluate(() => { const D = __dz, P = D.player; P.pos.y = Math.min(P.pos.y, D.groundAt(P.pos.x, P.pos.z, 200) + 2.5); let i = 0; window.__noRender = true; while (P.st !== 'ground' && i++ < 400) __tickD(1, 50); window.__noRender = false; __tickD(2, 50); });
  if (cb) await cb('land');
}

const G = {
  async desk(b) {
    const p = await boot(b, 'desk');
    await shot(p, 'd01_menu', () => __tick(20), { page: true });
    await shot(p, 'd01b_menu_t2', () => { __dz.fxTier = 2; __tick(2); }, { page: true });
    await p.evaluate(() => { __dz.fxTier = 1; });
    await toBus(p);
    await shot(p, 'd02_bus_hud', () => __tick(6, 50), { page: true });
    // the Drifter from close by, glows and haze included (plane shader + its ShaderMaterial)
    await tierShots(p, 'd03_plane', () => { const D = __dz, q = D.busPos(D.matchT()); window.__dzq = q; __tick(1, 50); T.cam([q.x + 26, q.y + 6, q.z + 30], [q.x, q.y, q.z], 55); });
    await dropAndLand(p, async k => { await shot(p, 'd04_' + k, null, { page: k === 'land' }); });
    // bots off the island for the scenery views, the player too
    await p.evaluate(() => { T.hideBots(); __dz.player.model.visible = false; window.__noRender = true; });
    // views over the island: every named place, from eye height and from above, with the camera fixed
    const pl = await p.evaluate(() => __dz.places.map(q => [q.name || q.n, q.x, q.z]));
    out('places ' + JSON.stringify(pl.map(q => [q[0], Math.round(q[1]), Math.round(q[2])])));
    let k = 0;
    for (const [n, x, z] of pl) {
      const ang = k * 1.7, dist = 18 + (k % 3) * 6, hgt = 2.2 + (k % 2) * 1.5; k++;
      await tierShots(p, `v${String(k).padStart(2, '0')}_${String(n).replace(/\W+/g, '').slice(0, 14)}`, ([x, z, ang, dist, hgt]) => {
        const D = __dz, cx = x + Math.sin(ang) * dist, cz = z + Math.cos(ang) * dist, cy = D.groundAt(cx, cz, 200) + hgt;
        T.cam([cx, cy, cz], [x, D.groundAt(x, z, 200) + 1.5, z], 60); }, k <= 3 ? [1, 0, 2] : [1], [x, z, ang, dist, hgt]);
    }
    // the reservoir, the shore and the sea, the whole island from high up
    await tierShots(p, 'w01_lake', () => T.cam([202, 30, 136], [202, 17, 70], 60));
    await tierShots(p, 'w02_shore', () => T.cam([120, 6, 236], [120, 0, 300], 60));
    await tierShots(p, 'w03_island_high', () => T.cam([-60, 140, 300], [120, 0, 120], 55), [1, 0]);
    // characters: a group of bots close up, standing, running, gliding and falling (flutter), with a crowbar and guns
    await tierShots(p, 'c01_people', () => { const D = __dz, bs = [...D.bots.values()], [x, z] = [118, 151], y = D.groundAt(x, z, 200);
      T.place(bs[0], x - 1.6, z, 0.4, { held: 'ar' }); T.place(bs[1], x, z - .6, -0.3, { held: 'sg' }); T.place(bs[2], x + 1.6, z, 0.2);
      T.place(bs[3], x + .5, z - 3, 0, { st: 'glide', y: y + 4 }); T.place(bs[4], x - 2.5, z - 4, 0, { st: 'fall', y: y + 6 });
      T.cam([x + 1, y + 2.2, z + 6.5], [x, y + 1.6, z - 1], 50); });
    // a fight: the player shooting at a bot behind a build (muzzle flash, shot trail, hit, builds, an edited wall)
    await p.evaluate(() => { const D = __dz, P = D.player; P.model.visible = true; D.teleport(118, 151); P.yaw = 0; P.pitch = -.05; D.give('ar', 3); });
    await p.evaluate(() => { const D = __dz, P = D.player, cx = Math.floor(118 / 4), cz = Math.floor(151 / 4) - 3;
      D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx, z: cz, L: 1 }), null, true, 'me'); D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx + 1, z: cz, L: 1 }), null, true, 'me');
      D.tryBuild(D.landFit({ kind: 'ramp', x: cx - 1, z: cz, L: 1, dir: 0 }, true), null, true, 'me');
      const w = [...D.pieces.values()][0]; if (w) D.editPiece(w, 18, true);
      const bt = [...D.bots.values()][5]; T.place(bt, 121, 140, Math.PI, { held: 'ar' }); __tick(4, 50); });
    await tierShots(p, 'f01_fight', () => { const D = __dz, bt = [...D.bots.values()][5]; window.__noRender = true; D.aimAt(bt); D.fire(); __tick(1, 16); D.fire(); __tick(2, 16); window.__noRender = false; });
    await shot(p, 'f02_fight_hud', null, { page: true });
    // the storm: run the match clock on (unrendered) until the second circle; the wall from outside and the rain inside
    await p.evaluate(() => { const D = __dz, P = D.player; P.hp = 1e6; window.__noRender = true; let i = 0; while (D.matchT() < 160 && i++ < 5000) { __tick(1, 100); P.hp = 100; P.alive = true; } window.__noRender = false; });
    out('storm: ' + JSON.stringify(await p.evaluate(() => ({ t: +__dz.matchT().toFixed(1), alive: __dz.player.alive, st: __dz.state, storm: __dz.storm ? Object.keys(__dz.storm) : null }))));
    await tierShots(p, 's01_storm_wall', () => { const D = __dz, s = D.stormAt(D.matchT()); window.__s = s; const cx = s.x || s.cx || 120, cz = s.z || s.cz || 120, r = s.r || 60;
      __tick(1, 50); T.cam([cx, 30, cz + r - 30], [cx, 20, cz + r + 40], 60); });
    out('stormAt ' + JSON.stringify(await p.evaluate(() => window.__s)));
    await shot(p, 's02_storm_hud', null, { page: true });
    // the end: the player is knocked out; the end screen
    await p.evaluate(() => { const D = __dz, P = D.player, bs = [...D.bots.values()].filter(b => b.alive); D.die(P, bs[0] && bs[0].id, 'ar'); window.__noRender = true; __tick(60, 50); window.__noRender = false; });
    await shot(p, 'e01_end', null, { page: true });
    out('end state ' + await p.evaluate(() => __dz.state));
    out(`[desk] errors ${p.errs.length} warnings ${p.warns.length}`);
    await p.context().close();
  },
  async fast(b) {
    const p = await boot(b, 'fast', { ls: { 'driftfall:gfx': 'fast' } });
    await shot(p, 'g01_menu', () => __tick(20), { page: true });
    await toBus(p);
    await dropAndLand(p);
    await p.evaluate(() => { T.hideBots(); __dz.player.model.visible = false; });
    const pl = await p.evaluate(() => __dz.places.map(q => [q.name || q.n, q.x, q.z]));
    let k = 0;
    for (const [n, x, z] of pl.slice(0, 3)) {
      const ang = k * 1.7, dist = 18 + (k % 3) * 6, hgt = 2.2 + (k % 2) * 1.5; k++;
      await shot(p, `g1${k}_${String(n).replace(/\W+/g, '').slice(0, 14)}`, ([x, z, ang, dist, hgt]) => { const D = __dz, cx = x + Math.sin(ang) * dist, cz = z + Math.cos(ang) * dist, cy = D.groundAt(cx, cz, 200) + hgt;
        window.__noRender = true; T.cam([cx, cy, cz], [x, D.groundAt(x, z, 200) + 1.5, z], 60); }, { arg: [x, z, ang, dist, hgt] }).catch(e => out('fail ' + e.message));
    }
    await shot(p, 'g20_lake', () => T.cam([202, 30, 136], [202, 17, 70], 60));
    await p.evaluate(() => { const D = __dz, P = D.player; window.__noRender = true; let i = 0; while (D.matchT() < 160 && i++ < 5000) { __tick(1, 100); P.hp = 100; P.alive = true; } window.__noRender = false; });
    await shot(p, 'g30_storm_wall', () => { const D = __dz, s = D.stormAt(D.matchT()); const cx = s.x || s.cx || 120, cz = s.z || s.cz || 120, r = s.r || 60; T.cam([cx, 30, cz + r - 30], [cx, 20, cz + r + 40], 60); });
    out(`[fast] errors ${p.errs.length} warnings ${p.warns.length}`);
    await p.context().close();
  },
  async lock(b) {
    // the Locker on (test switch), wearing an outfit and every extra: glider 3, trail 2, gun skin 5, build skin 2, backpack 3
    const p = await boot(b, 'lock', { q: '?event=none&locker=1', ls: { 'driftfall:lx': 'g3t2w5b2p3', 'driftfall:skin': '7' } });
    await p.waitForFunction(() => !!__dz.LX, null, { timeout: 120000 }).catch(() => out('LX not loaded'));
    await shot(p, 'l01_menu', () => __tick(20), { page: true });
    await p.evaluate(() => { const x = document.getElementById('lockerBtn'); if (x) x.click(); __tick(30); });
    await shot(p, 'l02_locker', () => __tick(30), { page: true });
    for (const tab of ['g', 't', 'w', 'b']) {
      const ok = await p.evaluate(t => { const el = document.querySelector(`[data-tab="${t}"]`) || [...document.querySelectorAll('#locker button, .lockerTabs button')].find(e => e.dataset && e.dataset.tab === t); if (el) { el.click(); __tick(30); return true; } return false; }, tab);
      if (ok) await shot(p, 'l03_tab_' + tab, () => __tick(10), { page: true });
    }
    await p.evaluate(() => { try { __dz.Locker.close(); } catch (e) {} const c = document.querySelector('#lockerClose,[data-close]'); if (c) c.click(); __tick(5); });
    await toBus(p);
    await dropAndLand(p, async k => { if (k === 'glide') await shot(p, 'l10_glide_trail'); });
    await p.evaluate(() => { const D = __dz, P = D.player; D.teleport(118, 151); P.yaw = 0; P.pitch = -.05; D.give('ar', 3); D.give('sg', 2); T.hideBots();
      const cx = Math.floor(118 / 4), cz = Math.floor(151 / 4) - 3; P.mats = 200;
      D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx, z: cz, L: 1 }), P, true); D.tryBuild(D.landFit({ kind: 'wall', o: 'H', x: cx + 1, z: cz, L: 1 }), P, true);
      const w = [...D.pieces.values()][0]; if (w) D.editPiece(w, 18, true); __tick(4, 50); });
    await tierShots(p, 'l11_skins', null, [1, 0]);
    // a group of bots wearing Locker gliders, in the air
    await tierShots(p, 'l12_gliders', () => { const D = __dz, bs = [...D.bots.values()], x = 118, z = 151, y = D.groundAt(x, z, 200);
      bs.slice(0, 3).forEach((bt, i) => { bt.lxForce = true; bt.lxo = { g: 1 + i * 2 }; T.place(bt, x - 2.5 + i * 2.5, z - 2, 0, { st: 'glide', y: y + 5 }); });
      __dz.player.model.visible = false; T.cam([x, y + 5.5, z + 6], [x, y + 5, z - 2], 55); }, [1, 0]);
    out(`[lock] errors ${p.errs.length} warnings ${p.warns.length} skinned-shadow warnings ${await p.evaluate(() => window.__skinWarn)}`);
    await p.context().close();
  },
  async x(b) {
    // close stills where each shader edit shows: an edited plywood wall (partMat), an edited wall in a build skin (the
    // build-skin edit on partMat), grass tufts from ground level (tufts), outfit legs and knees (FLMAT, knee), a body in the air (BMAT flutter)
    const p = await boot(b, 'x', { q: '?event=none&locker=1' });
    await p.waitForFunction(() => !!__dz.LX, null, { timeout: 120000 }).catch(() => out('LX not loaded'));
    await toBus(p);
    await dropAndLand(p);
    await p.evaluate(() => { T.hideBots(); __dz.player.model.visible = false; });
    out('edit: ' + JSON.stringify(await p.evaluate(() => { const D = __dz; for (const pc of [...D.pieces.values()]) D.removePiece(pc, false);
      const cx = 30, cz = 37; const s1 = D.landFit({ kind: 'wall', o: 'H', x: cx, z: cz, L: 1 }), s2 = D.landFit({ kind: 'wall', o: 'H', x: cx + 1, z: cz, L: 1 }), s3 = D.landFit({ kind: 'wall', o: 'H', x: cx + 2, z: cz, L: 1 });
      D.tryBuild(s1, null, true, 'me'); D.tryBuild(s2, null, true, 'me'); D.tryBuild(s3, null, true, 'me');
      const ps = [...D.pieces.values()]; if (ps[0]) D.editPiece(ps[0], 18, true); if (ps[1]) { ps[1].bs = 3; D.editPiece(ps[1], 6, true); } if (ps[2]) ps[2].bs = 3;
      __tick(4, 50); const c = D.pieceCentre(ps[1].spec); window.__wc = [c.x, c.y, c.z];
      return { n: ps.length, ed: ps.map(q => q.ed), part: D.partIM.count, vis: D.partIM.visible, c: window.__wc }; })));
    await tierShots(p, 'x01_edited_walls', () => { const c = window.__wc; T.cam([c[0] + 1, c[1] + .5, c[2] + 7], [c[0], c[1], c[2]], 60); }, [1, 0]);
    await tierShots(p, 'x02_tufts', () => { const D = __dz; let best = null; for (let i = 0; i < 4000 && !best; i++) { const x = 20 + (i * 37) % 200, z = 20 + (i * 53) % 200; const y = D.groundAt(x, z, 200); if (y > 3 && y < 12 && D.terrainSlope(x, z) < .2) best = [x, y, z]; }
      window.__tp = best; T.cam([best[0], best[1] + .7, best[2]], [best[0] + 6, best[1] + .1, best[2] - 6], 60); }, [1, 0]);
    out('tuft spot ' + JSON.stringify(await p.evaluate(() => window.__tp)));
    out('outfits ' + await p.evaluate(() => __dz.OUTFITS.length));
    await tierShots(p, 'x03_outfits', () => { const D = __dz, bs = [...D.bots.values()], x = 118, z = 151, y = D.groundAt(x, z, 200), n = D.OUTFITS.length;
      for (let i = 0; i < 5; i++) { const bt = bs[i], f = 1 + ((i * 5) % (n - 1)); D.setModelColor(bt.model, bt.model.userData.hex, i % 6, f, ''); bt.fit = f;
        T.place(bt, x - 3 + i * 1.5, z, 0.3 * i, { st: i === 4 ? 'fall' : 'ground', y: i === 4 ? y + 2.5 : undefined }); bt.vel.set(0, 0, i === 2 ? -6 : 0); }
      for (let k = 0; k < 20; k++) for (let i = 0; i < 5; i++) D.animModel(bs[i], 1 / 60);
      T.cam([x, y + 1.6, z + 5.5], [x, y + 1.1, z], 55); }, [1, 0]);
    await tierShots(p, 'x04_legs_low', () => { const D = __dz, x = 118, z = 151, y = D.groundAt(x, z, 200); T.cam([x - .5, y + .7, z + 4.5], [x, y + .5, z], 60); }, [1, 0]);
    out('legs ' + await p.evaluate(() => JSON.stringify({ leg: __dz.legIM.count, fit: __dz.fitLegIM.count })));
    // grass tufts: the camera low beside one of them (the instanced, double-sided Lambert mesh with ~4,400 copies)
    await tierShots(p, 'x05_tufts_close', () => { const D = __dz; let im = null; D.scene.traverse(o => { if (o.isInstancedMesh && o.material.side === THREE.DoubleSide && o.material.isMeshLambertMaterial && o.count > 1000) im = o; });
      const m = new THREE.Matrix4(), v = new THREE.Vector3(); let best = null; for (let i = 0; i < im.count; i += 7) { im.getMatrixAt(i, m); v.setFromMatrixPosition(m); if (Math.abs(v.x - 118) < 40 && Math.abs(v.z - 151) < 40) { best = v.clone(); break; } }
      if (!best) { im.getMatrixAt(0, m); best = v.setFromMatrixPosition(m).clone(); } window.__tuft = [best.x, best.y, best.z, im.count];
      T.cam([best.x + 1.2, best.y + .45, best.z + 1.2], [best.x - 2, best.y + .1, best.z - 2], 60); }, [1, 0]);
    out('tuft ' + JSON.stringify(await p.evaluate(() => window.__tuft)));
    out(`[x] errors ${p.errs.length} warnings ${p.warns.length}`);
    await p.context().close();
  },
  async phone(b) {
    for (const [w, h] of [[844, 390], [390, 844]]) {
      const p = await boot(b, 'ph' + w, { w, h, touch: true });
      await shot(p, `p${w}_menu`, () => __tick(20), { page: true });
      await toBus(p);
      await shot(p, `p${w}_bus`, () => __tick(6, 50), { page: true });
      await dropAndLand(p);
      await p.evaluate(() => { __dz.give('ar', 2); __tick(10, 50); });
      await shot(p, `p${w}_ground`, null, { page: true });
      const vis = await p.evaluate(() => { const r = id => { const e = document.getElementById(id); if (!e || e.hidden || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
        const ids = ['tPause', 'vitals', 'slots', 'mapBox', 'tStick', 'tFire', 'tJump', 'tAim', 'tReload', 'feed', 'ammo', 'tUse', 'tEdit', 'tEmote', 'hint']; const o = {}; for (const i of ids) o[i] = r(i);
        const k = Object.keys(o).filter(i => o[i]), ov = []; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = o[k[i]], c = o[k[j]]; if (!(a[2] <= c[0] || c[2] <= a[0] || a[3] <= c[1] || c[3] <= a[1])) ov.push(k[i] + '/' + k[j]); }
        return { o, ov, touch: document.body.classList.contains('touch'), docW: document.documentElement.scrollWidth }; });
      out(`p${w} touch ${JSON.stringify(vis)}`);
      out(`[ph${w}] errors ${p.errs.length} warnings ${p.warns.length}`);
      await p.context().close();
    }
  },
};
(async () => {
  const b = await launch(); const t0 = Date.now();
  for (const g of Object.keys(G)) { if (ONLY.length && !ONLY.includes(g)) continue; const t = Date.now(); try { await G[g](b); } catch (e) { out(`GROUP ${g} FAILED: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); } out(`group ${g} ${((Date.now() - t) / 1000).toFixed(0)}s`);
    fs.writeFileSync(OUT + '/log-' + (ONLYS || 'all') + '.txt', log.join('\n') + '\n'); fs.writeFileSync(OUT + '/info-' + (ONLYS || 'all') + '.json', JSON.stringify(INFO, null, 1)); }
  await b.close();
  out(`total ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  fs.writeFileSync(OUT + '/log-' + (ONLYS || 'all') + '.txt', log.join('\n') + '\n'); fs.writeFileSync(OUT + '/info-' + (ONLYS || 'all') + '.json', JSON.stringify(INFO, null, 1));
})();
