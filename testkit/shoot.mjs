// Gunplay numbers through the real fire path (weapons.js fire(), real bullets, real hit spheres) against a stand-in
// guard (100 hp, standing, facing you) placed in the open at 10/25/50 m. argv[2] = label.
//   rpm, damage by zone and range (first aimed shot at the zone centre), shots and seconds to kill aimed and from
//   the hip (trigger held / tapped as fast as the gun allows, no recoil control, 6 trials), the recoil path of a
//   full magazine per shot (5 magazines), spread by state, aim time, reload times, health, aim assist default,
//   a 30 m hold test (hits per magazine with and without pull-down, bursts vs full auto).
import fs from 'fs';
import { open, waitState, OUT } from './lib.mjs';
const label = process.argv[2] || 'run';
const { browser, page, errors } = await open({ viewport: { width: 800, height: 450 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 1, missions: { bootcamp: { done: true } }, settings: { quality: 0 }, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
await page.evaluate(() => {
  __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, C = IV.camera, WP = IV.weapons, W = IV.world;
  IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true; P.god = true;
  for (const e of IV.ai.list) { e.alive = false; }
  WP.has.rifle = WP.has.smg = WP.has.pistol = true;
  const S = window.__S = {};
  S.tick = (n = 1) => { for (let i = 0; i < n; i++) { __IV__.step(1); P.frame(1, 1 / 60); C.frame(1 / 60); } };
  // find a flat open lane: start at (0,120) facing north
  S.x0 = 0; S.z0 = 120;
  // a lane 60 m long, clear at knee, chest and head height and gently sloped, facing north
  const F = IV.CF; let found = null;
  for (let r = 0; r < 260 && !found; r += 10) for (let a = 0; a < 24 && !found; a++) {
    const x = Math.round(Math.cos(a / 24 * 6.283) * r), z = Math.round(120 + Math.sin(a / 24 * 6.283) * r);
    let ok = true; const h0 = W.height(x, z);
    for (const d of [10, 25, 50, 60]) if (Math.abs(W.height(x, z - d) - h0) > 2) ok = false;
    if (ok) for (const hy of [0.5, 1.2, 1.7]) for (const d of [10, 25, 50]) if (!W.clear(x, h0 + 1.6, z, x, W.height(x, z - d) + hy, z - d - 0.5, F.BULLET)) ok = false;
    if (ok) found = [x, z];
  }
  if (found) { S.x0 = found[0]; S.z0 = found[1]; } S.lane = found;
  const dummy = S.dummy = { team: 'them', alive: true, pos: new THREE.Vector3(), bodyYaw: 0, stance: 'stand', hp: 100, log: [],
    stanceKey() { return 'stand'; }, chestH() { return 1.3; }, eye() { return this.pos.y + 1.6; }, suppress() {},
    hit(zone, dmg) { this.log.push([zone, dmg]); this.hp -= dmg; if (this.hp <= 0) this.alive = false; } };
  const orig = WP.combatants; WP.combatants = () => { const l = orig(); if (dummy.alive) l.push(dummy); return l; };
  S.place = d => { __IV__.teleport(S.x0, S.z0, 0); P.vel.set(0, 0, 0); const z = S.z0 - d; dummy.pos.set(S.x0, W.height(S.x0, z), z); dummy.bodyYaw = Math.PI; dummy.alive = true; dummy.hp = 100; dummy.log = []; };
  S.zoneY = { head: 1.66, chest: 1.2, leg: 0.72 };
  S.zoneX = { head: 0, chest: 0, leg: 0.11 };
  S.aimAt = (x, y, z) => { for (let i = 0; i < 3; i++) { C.frame(1 / 60); const c = W.camera.position; P.yaw = IV.yawTo(x - c.x, z - c.z); P.pitch = Math.atan2(y - c.y, Math.hypot(x - c.x, z - c.z)); } C.frame(1 / 60); };
  S.aimZone = zn => S.aimAt(dummy.pos.x + S.zoneX[zn], dummy.pos.y + S.zoneY[zn], dummy.pos.z);
  S.rest = (n = 70) => { __IV__.press('fire', false); for (let i = 0; i < n; i++) S.tick(1); C.trauma = 0; };
  S.flush = () => { let n = 0; while (WP.bullets.some(b => b.owner === WP.playerEnt) && n < 200) { S.tick(1); n++; } };
  S.ready = (k, aim) => { P.setStance('stand'); S.tick(30); WP.equip(k); S.tick(40); WP.inv[k].mag = IV.TUNING.weapons[k].mag; WP.inv[k].res = 999; __IV__.press('aim', !!aim); __IV__.press('breath', !!aim && k === 'rifle'); S.tick(45); };
  return 1;
});
const out = { label, weapons: {} };
// ---------------- static numbers
out.static = await page.evaluate(() => { const IV = __IV__.IV, T = IV.TUNING; return { lane: __S.lane, health: T.health, assistDefaultMouse: IV.DEF_SETTINGS.assist, touch: IV.touch, assistTable: T.assist, diff: IV.mission.DIFF }; });
for (const k of ['smg', 'pistol', 'rifle']) {
  const r = await page.evaluate(k => {
    const IV = __IV__.IV, P = IV.player, C = IV.camera, WP = IV.weapons, W = IV.world, S = __S, T = IV.TUNING, w = T.weapons[k], semi = w.rpm < 400;
    const res = { weapon: k };
    // rpm: trigger held (auto) or tapped every frame (semi) for 2 s
    S.place(200); S.ready(k, false); P.pitch = 0.3; let shots0 = WP.stats.shots, f = 0;
    for (; f < 120; f++) { if (semi) __IV__.press('fire', f % 2 === 0); else __IV__.press('fire', true); __IV__.step(1); }
    S.rest(30); res.rpm_measured = Math.round((WP.stats.shots - shots0) / 2 * 60);
    // damage: one first aimed shot at each zone centre, per range
    res.dmg = {};
    for (const d of [10, 25, 50]) {
      res.dmg[d] = {};
      for (const zn of ['head', 'chest', 'leg']) {
        S.place(d); S.ready(k, true); S.dummy.hp = 1e9; S.aimZone(zn); S.rest(20); S.aimZone(zn);
        __IV__.press('fire', true); S.tick(1); __IV__.press('fire', false); S.flush();
        const h = S.dummy.log[0]; res.dmg[d][zn] = h ? h[0] + ':' + h[1].toFixed(0) : 'miss';
        __IV__.press('aim', false); __IV__.press('breath', false);
      }
    }
    // time to kill: chest, trigger held / tapped as fast as allowed, no recoil control, 6 trials
    res.ttk = {};
    for (const d of [10, 25, 50]) for (const aim of [true, false]) {
      const tr = [];
      for (let t = 0; t < 6; t++) {
        S.place(d); S.ready(k, aim); S.aimZone('chest'); S.rest(20); S.aimZone('chest');
        const s0 = WP.stats.shots; let n = 0, tKill = null;
        while (n < 60 * 8) {
          if (semi) __IV__.press('fire', n % 2 === 0); else __IV__.press('fire', true);
          S.tick(1); n++;
          if (WP.inv[k].mag === 0) { WP.inv[k].mag = w.mag; }
          if (!S.dummy.alive) { tKill = n / 60; break; }
        }
        __IV__.press('fire', false);
        // the killing shot was fired before the bullet arrived: shots = fired when it died minus those still in flight
        const inflight = WP.bullets.filter(b => b.owner === WP.playerEnt).length;
        tr.push({ shots: WP.stats.shots - s0 - inflight, t: tKill, hits: S.dummy.log.length, zones: S.dummy.log.map(h => h[0][0] + Math.round(h[1])).join(' ') });
        S.flush(); __IV__.press('aim', false); __IV__.press('breath', false);
      }
      const ok = tr.filter(x => x.t != null);
      res.ttk[d + (aim ? 'm aimed' : 'm hip')] = ok.length ? { shots: +(ok.reduce((a, b) => a + b.shots, 0) / ok.length).toFixed(1), sec: +(ok.reduce((a, b) => a + b.t, 0) / ok.length).toFixed(2), killed: ok.length + '/6', eg: ok[0].zones } : { killed: '0/6' };
    }
    // spread (mrad), the eased live cone after settling in each state
    const sp = () => +(WP.currentSpread() * 1000).toFixed(1);
    res.spread = {};
    for (const aim of [false, true]) {
      const tag = aim ? 'aimed' : 'hip', o = res.spread[tag] = {};
      S.place(200); S.ready(k, aim); o.stand = sp();
      P.setStance('crouch'); S.tick(40); o.crouch = sp();
      P.setStance('prone'); S.tick(60); o.prone = sp();
      P.setStance('stand'); S.tick(40);
      if (!aim) { __IV__.press('forward', true); S.tick(50); o.jog = sp(); o.jogSpeed = +P.speed.toFixed(1); __IV__.press('forward', false); S.tick(40); }
      else { __IV__.press('forward', true); S.tick(50); o.walkAimed = sp(); o.walkSpeed = +P.speed.toFixed(1); __IV__.press('forward', false); S.tick(40); }
      __IV__.press('vault', true); S.tick(1); __IV__.press('vault', false); S.tick(14); o.air = sp(); o.airborne = P.grounded === false; S.tick(60);
      __IV__.press('aim', false); __IV__.press('breath', false); S.tick(20);
    }
    // aim time: frames until the eased ADS reaches 99 %
    S.place(200); S.ready(k, false); __IV__.press('aim', true); let af = 0; while (af < 120 && !(C.adsE >= 0.99 && (k !== 'rifle' || C.scopeView))) { S.tick(1); af++; } res.aim_ms = Math.round(af / 60 * 1000); __IV__.press('aim', false); S.tick(40);
    // reload: empty and partial
    for (const kind of ['empty', 'partial']) {
      S.ready(k, false); WP.inv[k].mag = kind === 'empty' ? 0 : 1; __IV__.press('reload', true); S.tick(1); __IV__.press('reload', false);
      let rf = 1; while (rf < 600 && WP.reloadT > 0) { S.tick(1); rf++; } res['reload_' + kind + '_s'] = +(rf / 60).toFixed(2); res['reload_' + kind + '_mag'] = WP.inv[k].mag;
    }
    return res;
  }, k);
  out.weapons[k] = r; console.log(JSON.stringify(r));
}
// ---------------- recoil paths (5 magazines, hip and aimed), per shot view pitch / yaw in mrad
out.recoil = await page.evaluate(() => {
  const IV = __IV__.IV, P = IV.player, C = IV.camera, WP = IV.weapons, S = __S, T = IV.TUNING;
  const res = {};
  for (const k of ['smg', 'pistol', 'rifle']) for (const aim of [true]) {
    const w = T.weapons[k], semi = w.rpm < 400, mags = [];
    for (let m = 0; m < 5; m++) {
      S.place(300); S.ready(k, aim); P.pitch = 0; P.yaw = 0; S.rest(90);
      const p0 = P.pitch + C.recP, y0 = P.yaw + C.recY, path = []; let n = 0, last = WP.stats.shots;
      const shotsWanted = k === 'rifle' ? 1 : w.mag;
      while (path.length < shotsWanted && n < 600) {
        if (semi) __IV__.press('fire', n % 2 === 0); else __IV__.press('fire', true);
        S.tick(1); n++;
        if (WP.stats.shots > last) { last = WP.stats.shots; S.tick(0); path.push([+((P.pitch + C.recP - p0) * 1000).toFixed(1), +((P.yaw + C.recY - y0) * 1000).toFixed(1)]); }
      }
      __IV__.press('fire', false); mags.push(path); __IV__.press('aim', false); __IV__.press('breath', false); S.tick(20);
    }
    // repeatability: per shot, the spread of the 5 paths around their mean, relative to the size of the mean path
    const ns = Math.min(...mags.map(p => p.length)), mean = [];
    for (let i = 0; i < ns; i++) mean.push([mags.reduce((a, p) => a + p[i][0], 0) / 5, mags.reduce((a, p) => a + p[i][1], 0) / 5]);
    let dev = 0, size = 0;
    for (let i = 0; i < ns; i++) { size = Math.max(size, Math.hypot(mean[i][0], mean[i][1])); for (const p of mags) dev = Math.max(dev, Math.hypot(p[i][0] - mean[i][0], p[i][1] - mean[i][1])); }
    let avgDev = 0; for (let i = 0; i < ns; i++) for (const p of mags) avgDev += Math.hypot(p[i][0] - mean[i][0], p[i][1] - mean[i][1]) / (5 * ns);
    res[k + (aim ? '_aimed' : '_hip')] = { meanPath_mrad: mean.map(v => v[0].toFixed(0) + ',' + v[1].toFixed(0)).join(' '), finalPitch: mean[ns - 1][0].toFixed(1), finalYaw: mean[ns - 1][1].toFixed(1), maxDevPct: +(dev / (size || 1) * 100).toFixed(1), avgDevPct: +(avgDev / (size || 1) * 100).toFixed(1),
      yawFinalPerMag: mags.map(p => p[ns - 1][1]).join(' ') };
  }
  // the rifle and pistol single kick curve: view pitch after one shot per 1/60 s
  for (const k of ['rifle', 'pistol']) {
    S.place(300); S.ready(k, true); P.pitch = 0; S.rest(90); const p0 = P.pitch + C.recP;
    __IV__.press('fire', true); S.tick(1); __IV__.press('fire', false); const c = [];
    for (let i = 0; i < 48; i++) { S.tick(1); c.push(+((P.pitch + C.recP - p0) * 1000).toFixed(0)); }
    res[k + '_kickCurve_mrad'] = c.join(' '); res[k + '_kept_mrad'] = +((P.pitch - p0) * 1000).toFixed(1);
    __IV__.press('aim', false); __IV__.press('breath', false); S.tick(20);
  }
  return res;
});
console.log(JSON.stringify(out.recoil, null, 1));
// ---------------- 30 m hold test: SMG aimed at the chest, hits per magazine; pull-down = the aim is pulled back to
// the target (the view, kick included) 12 % of the way per frame (a human-ish correction, no knowledge of the pattern)
out.hold30 = await page.evaluate(() => {
  const IV = __IV__.IV, P = IV.player, C = IV.camera, WP = IV.weapons, S = __S, T = IV.TUNING;
  const res = {};
  for (const k of ['smg']) for (const mode of ['auto', 'auto+pull', 'burst4', 'burst4+pull', 'tap', 'tap+pull']) for (const aim of [true, false]) {
    let hits = 0, shots = 0, heads = 0; const trials = 4;
    for (let t = 0; t < trials; t++) {
      S.place(30); S.ready(k, aim); S.aimZone('chest'); S.rest(30); S.aimZone('chest'); S.dummy.hp = 1e9;
      const py = P.yaw, pp = P.pitch; let n = 0, inStr = 0, gap = 0; const s0 = WP.stats.shots, h0 = S.dummy.log.length;
      const pull = mode.indexOf('pull') >= 0, burst = mode.startsWith('burst') ? 4 : mode === 'tap' ? 1 : 0, pause = mode === 'tap' ? 14 : 18;
      WP.inv[k].mag = T.weapons[k].mag; WP.inv[k].res = 999;
      while (WP.inv[k].mag > 0 && n < 60 * 12) {
        let want = true;
        if (burst) { if (gap > 0) { want = false; gap--; } }
        const before = WP.stats.shots;
        __IV__.press('fire', want); S.tick(1); n++;
        if (WP.stats.shots > before && burst) { inStr++; if (inStr >= burst) { inStr = 0; gap = pause; } }
        if (pull) { P.pitch += (pp - (P.pitch + C.recP)) * 0.12; P.yaw += IV.wrapA(py - (P.yaw + C.recY)) * 0.12; }   // pull the VIEW back onto the target, as a player does
      }
      __IV__.press('fire', false); S.flush();
      shots += WP.stats.shots - s0; const lg = S.dummy.log.slice(h0); hits += lg.length; heads += lg.filter(h => h[0] === 'head').length;
      __IV__.press('aim', false);
    }
    res[k + ' ' + mode + (aim ? ' aimed' : ' hip')] = { hitsPerMag: +(hits / trials).toFixed(1), hitPct: Math.round(hits / shots * 100) };
  }
  return res;
});
console.log(JSON.stringify(out.hold30, null, 1));
fs.writeFileSync(OUT + '/shoot-' + label + '.json', JSON.stringify(out, null, 1));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
