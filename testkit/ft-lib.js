// Midnight Ops scripted-fight harness (test only; injected into the page after a mission has loaded with ?test).
// Builds a small arena of invisible colliders on open ground in Night Drop, spawns soldiers, drives the player
// through the real controls (keys via __IV__.press, look via yaw/pitch), steps the simulation without drawing,
// and logs every enemy round, hit, telegraph and token. Math.random is reseeded per run so runs repeat.
window.FT = (function () {
  const H = __IV__, IV = H.IV, P = IV.player, W = IV.world, AI = IV.ai, WP = IV.weapons, STEP = IV.TUNING.step;
  const FT = {};
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const realRandom = Math.random;
  FT.seed = s => { Math.random = rng(s * 7919 + 17); IV.R = IV.rng ? IV.rng(s + 1944) : IV.R; };
  const C = FT.C = { x: 70, z: -155 };
  const groups = {};
  function box(g, x, z, hx, hz, h, kind) { const y0 = W.height(x, z) - 0.2; const c = W.addBox(x, z, hx, hz, y0, y0 + 0.2 + h, 0, 31, 'stone', kind); (groups[g] = groups[g] || []).push(c); return c; }
  FT.buildArena = function () {
    if (FT.built) return;
    box('pwall', 70, -143.2, 4.5, 0.3, 1.15, 'sandbags');
    for (const [x, z] of [[58, -166], [66, -170], [74, -168], [82, -166], [62, -178], [78, -178], [90, -160], [50, -160], [70, -184]]) box('ewall', x, z, 1.6, 0.3, 1.1, 'sandbags');
    for (const [x, z] of [[50, -150], [92, -150]]) box('side', x, z, 0.3, 1.6, 1.1, 'sandbags');
    box('hedge', 87, -145.5, 12.5, 0.6, 2.6, 'hedge');
    box('hedge', 100.6, -158, 0.6, 12.5, 2.6, 'hedge');
    FT.built = true;
    return H.navRebuild();
  };
  FT.groups = groups;
  FT.setGroup = function (g, on) { for (const c of groups[g] || []) c.on = on; };
  FT.layout = function (on) { for (const g in groups) FT.setGroup(g, on.indexOf(g) >= 0); return H.navRebuild(); };
  let L = null;
  FT.log = () => L;
  function hook() {
    if (FT.hooked) return; FT.hooked = true;
    IV.on('hurt', h => { if (!L) return; L.hurt.push({ t: IV.time - L.t0, dmg: h.dmg, from: h.from ? { x: h.from.x, z: h.from.z } : null, by: (AI.list.find(e => h.from && Math.abs(e.pos.x - h.from.x) < 0.01 && Math.abs(e.pos.z - h.from.z) < 0.01) || {}).id }); });
    IV.on('enemyFire', f => { if (!L) return; L.fire.push({ t: IV.time - L.t0, id: f.e.id, at: !!f.atPlayer, sup: !!f.suppress, d: Math.hypot(f.e.pos.x - P.pos.x, f.e.pos.z - P.pos.z), seeT: f.e.seeT, expo: f.e.expo, tok: AI.tokens.size }); });
    IV.on('telegraph', t => { if (!L) return; L.tele.push({ t: IV.time - L.t0, id: t.e.id, delay: t.delay, kind: t.kind }); });
    IV.on('enemyDied', e => { if (!L) return; L.died.push({ t: IV.time - L.t0, id: e.id }); });
    IV.on('playerDied', () => { if (!L) return; L.pdied = IV.time - L.t0; });
    IV.on('aiOrder', o => { if (L) L.ev.push(o.kind + 'Order'); });
    const eg = WP.enemyGrenade; WP.enemyGrenade = function (from, x, z) { if (L) L.ev.push('grenade'); return eg.apply(this, arguments); };
  }
  FT.begin = function (seed, o) {
    hook(); FT.seed(seed);
    IV.mission.on = false; IV.mission.noWeapons = false; P.cine = null; P.frozen = false; P.vault = null; IV.ally.remove && IV.ally.remove();
    AI.reset(); WP.bullets.length = 0; WP.throws.length = 0;
    for (const k of ['forward', 'back', 'left', 'right', 'sprint', 'aim', 'fire', 'crouch', 'prone']) H.press(k, false);
    P.alive = true; P.hp = o.hp || 100; P.lastHurt = -99; P.god = false;
    if (P.actor) { P.actor.play('idle', { fade: 0 }); }
    H.teleport(o.px, o.pz, o.pyaw != null ? o.pyaw : IV.yawTo(C.x - o.px, C.z - o.pz)); P.pitch = 0;
    FT.setStance(o.stance || 'stand', true);
    if (WP.inv) for (const k in WP.inv) { WP.inv[k].mag = 999; WP.inv[k].res = 999; }
    if (o.weapon && WP.cur !== o.weapon) { WP.equip(o.weapon); }
    WP.reloadT = 0; WP.cool = 0;
    L = { t0: IV.time, seed, hurt: [], fire: [], tele: [], died: [], pdied: null, maxTok: 0, frames: 0, ev: [] };
    FT.enemies = []; AI.shotLog = [];
    for (const s of o.enemies || []) {
      const e = AI.spawn(Object.assign({ yaw: IV.yawTo(o.px - s.x, o.pz - s.z) }, s));
      if (s.combat) { e.aw = 1; e.lkp = { x: o.px, z: o.pz, t: IV.time }; e.target = WP.playerEnt; e.setState('combat'); }
      FT.enemies.push(e);
    }
    return L;
  };
  FT.tick = function (ctl) {
    if (ctl) ctl();
    H.step(1);
    IV.frameNo = (IV.frameNo || 0) + 1;
    P.frame(1, STEP); AI.frame(1, STEP); IV.ally.frame && IV.ally.frame(1, STEP); IV.camera.frame(STEP); WP.frame && WP.frame();
    L.frames++;
    if (AI.tokens.size > L.maxTok) L.maxTok = AI.tokens.size;
  };
  FT.run = function (sec, ctl, stop) { const n = Math.round(sec / STEP); for (let i = 0; i < n; i++) { FT.tick(ctl); if (stop && stop()) break; } };
  FT.setStance = function (st, now) {
    if (now) { P.stance = st; return; }
    if (P.stance === st) return;
    if (st === 'crouch' || (st === 'stand' && P.stance === 'crouch')) { H.press('crouch', true); FT.tick(); H.press('crouch', false); }
  };
  FT.aimAt = function (x, y, z, tau) {
    const c = W.camera.position, d = IV.camera.lookDir;
    const wy = IV.yawTo(x - c.x, z - c.z), wp = Math.atan2(y - c.y, Math.hypot(x - c.x, z - c.z));
    const cy = IV.yawTo(d.x, d.z), cp = Math.asin(IV.clamp(d.y, -1, 1));
    const ey = IV.wrapA(wy - cy), ep = wp - cp, k = Math.min(1, STEP / (tau || 0.1));
    P.yaw += ey * k; P.pitch += ep * k;
    return Math.hypot(ey, ep);
  };
  FT.chest = e => { const sp = []; WP.spheres(e, sp); const s = sp.find(q => q[4] === 'chest') || sp.find(q => q[4] !== 'head' && q[4] !== 'limb') || sp[0]; return s ? { x: s[0], y: s[1], z: s[2] } : { x: e.pos.x, y: e.pos.y + 1.2, z: e.pos.z }; };
  FT.visible = e => { const c = W.camera.position, p = FT.chest(e); return e.alive && W.clear(c.x, c.y, c.z, p.x, p.y, p.z, IV.CF.BULLET); };
  FT.gunner = function (o) {
    const st = { tgt: null, since: 0, burst: 0, gap: 0, noise: { y: 0, p: 0 } };
    return function () {
      const live = FT.enemies.filter(e => e.alive && FT.visible(e));
      if (!live.length) { st.tgt = null; H.press('fire', false); H.press('aim', !!o.keepAim); return; }
      if (!st.tgt || !st.tgt.alive || live.indexOf(st.tgt) < 0) {
        st.tgt = live.sort((a, b) => Math.hypot(a.pos.x - P.pos.x, a.pos.z - P.pos.z) - Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z))[0];
        st.since = 0; st.noise = { y: (Math.random() - 0.5) * 0.02, p: (Math.random() - 0.5) * 0.015 };
      }
      st.since += STEP; H.press('aim', true);
      const c = FT.chest(st.tgt), d = Math.hypot(c.x - W.camera.position.x, c.z - W.camera.position.z);
      if (Math.random() < 0.05) st.noise = { y: (Math.random() - 0.5) * 0.012, p: (Math.random() - 0.5) * 0.01 };
      const off = FT.aimAt(c.x + Math.cos(P.yaw) * st.noise.y * d, c.y + st.noise.p * d, c.z - Math.sin(P.yaw) * st.noise.y * d, o.tau || 0.12);
      st.gap -= STEP;
      const on = st.since > (o.acq || 0.5) && off < 0.03;
      if (on && st.gap <= 0) { H.press('fire', true); st.burst++; if (st.burst >= (o.burst || 4)) { st.burst = 0; st.gap = o.burstGap || 0.35; H.press('fire', false); } }
      else H.press('fire', false);
    };
  };
  FT.move = function (dir, sprint) { for (const k of ['forward', 'back', 'left', 'right']) H.press(k, k === dir); H.press('sprint', !!sprint); };
  FT.stop = function () { FT.move(null, false); H.press('fire', false); H.press('aim', false); };
  FT.summary = function () {
    const atP = L.fire.filter(f => f.at), firstFire = atP.length ? atP[0].t : null;
    return { seed: L.seed, dur: +((L.frames * STEP)).toFixed(2), pdied: L.pdied == null ? null : +L.pdied.toFixed(2), firstFire: firstFire == null ? null : +firstFire.toFixed(2),
      dieAfterFire: L.pdied != null && firstFire != null ? +(L.pdied - firstFire).toFixed(2) : null,
      shotsAtP: atP.length, sup: L.fire.filter(f => f.sup).length, hits: L.hurt.length, dmg: Math.round(L.hurt.reduce((s, h) => s + h.dmg, 0)),
      kills: L.died.length, of: FT.enemies.length, maxTok: L.maxTok, hpEnd: Math.round(P.hp),
      teleMin: (function () { let m = 99; for (const tl of AI.teleLog) if (tl.first != null && tl.at >= L.t0) m = Math.min(m, tl.first - tl.at - tl.delay); return m === 99 ? null : +m.toFixed(3); })(),
      pMean: AI.shotLog && AI.shotLog.length ? +(AI.shotLog.reduce((a, b) => a + b.p, 0) / AI.shotLog.length).toFixed(3) : null,
      grenades: L.ev.filter(e => e === 'grenade').length, flankOrders: L.ev.filter(e => e === 'flankOrder').length,
      hitsPerSecUnderFire: firstFire == null ? 0 : +(L.hurt.length / Math.max(0.5, (L.pdied != null ? L.pdied : L.frames * STEP) - firstFire)).toFixed(2) };
  };
  FT.realRandom = realRandom;
  return FT;
})();
(function () {
  const H = __IV__, IV = H.IV, P = IV.player, W = IV.world;
  FT.walkTo = function (x, z, sprint) {
    const d = Math.hypot(x - P.pos.x, z - P.pos.z);
    if (d < 0.6) { FT.move(null, false); return true; }
    P.yaw = IV.yawTo(x - P.pos.x, z - P.pos.z); P.pitch = 0; FT.move('forward', sprint); return false;
  };
  FT.lamp = function (on, x, z) {
    W.lamps = W.lamps.filter(l => !l.ftLamp);
    if (on) W.addLamp({ x, y: W.height(x, z) + 2.5, z, r: 10, i: 1, on: true, los: false, ftLamp: true, color: 0xffffff });
  };
  const RIFLE = { kind: 'rifleman', combat: true }, SMG = { kind: 'rifleman', smg: true, combat: true };
  FT.squad = function (combat) { return [[58, -164.8], [66, -168.8], [74, -166.8], [82, -164.8], [70, -182.8]].map(([x, z], i) => Object.assign({ x, z }, i === 1 || i === 2 ? SMG : RIFLE, { combat: combat !== false })); };
  FT.anySee = () => FT.enemies.some(e => e.alive && e.seeing);
})();
