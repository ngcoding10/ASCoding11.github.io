// in-page helpers for Night Drop bots (fight what you can see, move with a path)
export const NDBOT = `
window.ND = (() => {
  const { H, IV, P, W } = BOT, F = IV.CF;
  const visible = (maxD, onlyCombat) => {
    let best = null, bd = maxD || 60;
    for (const e of IV.ai.list) {
      if (!e.alive) continue;
      if (onlyCombat && e.state !== 'combat') continue;
      const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d > bd) continue;
      if (!W.clear(P.pos.x, P.eyeY() + 0.1, P.pos.z, e.pos.x, e.pos.y + e.chestH(), e.pos.z, F.BULLET)) continue;
      bd = d; best = e;
    }
    return best;
  };
  // fight until nothing visible (aimed SMG bursts). Returns kills.
  function fight(maxSteps, onlyCombat) {
    let n = 0, kills = 0;
    if (IV.weapons.cur === 'rifle') { BOT.tap('smg'); H.step(25); }
    let snapped = false;
    while (n < (maxSteps || 1200) && P.alive && H.state() === 'play') {
      const e = visible(70, onlyCombat); if (!e) break;
      if (!snapped) { IV.camera.reset(); BOT.cam(2); snapped = true; }   // tests step without rendering: bring the camera to the player first
      const inv = IV.weapons.inv.smg; if (inv.mag === 0) { BOT.tap('reload'); H.step(140); n += 140; continue; }
      BOT.press('aim', true);
      for (let k = 0; k < 8 && e.alive; k++) { BOT.face(e.pos.x, e.pos.z, e.pos.y + e.chestH() - 0.05); BOT.cam(1); BOT.face(e.pos.x, e.pos.z, e.pos.y + e.chestH() - 0.05); BOT.press('fire', true); H.step(2); n += 2; }
      BOT.press('fire', false); H.step(6); n += 6;
      if (!e.alive) kills++;
    }
    BOT.press('aim', false); BOT.press('fire', false);
    return kills;
  }
  // walk to (x,z) along the nav path; stop and fight anything that is shooting at us (or anything visible when loud)
  function go(x, z, o) {
    o = o || {}; let path = IV.nav.path(P.pos.x, P.pos.z, x, z) || [{ x, z }], i = 0, n = 0, stuck = 0, lastD = 1e9;
    while (n++ < (o.max || 5000) && P.alive && H.state() === 'play') {
      const p = path[i]; if (!p) break;
      if (o.fight !== false && n % 8 === 0) { const e = visible(o.loud ? 55 : 40, !o.loud); if (e) { BOT.press('forward', false); BOT.press('sprint', false); if (o.crouchFight && P.stance === 'stand') BOT.tap('crouch'); fight(900, !o.loud); path = IV.nav.path(P.pos.x, P.pos.z, x, z) || path; i = 0; continue; } }
      // a careful player waits for the searchlight to pass instead of walking into it
      if (o.dark && n % 4 === 0) { const f = IV.fwd(IV.yawTo(p.x - P.pos.x, p.z - P.pos.z)); let w = 0; while (w < 900 && (W.lightAt(P.pos.x + f.x * 3, P.pos.y + 0.6, P.pos.z + f.z * 3) > 0.7 || W.lightAt(P.pos.x, P.pos.y + 0.6, P.pos.z) > 0.7)) { BOT.press('forward', false); H.step(6); w += 6; } }
      BOT.face(p.x, p.z); P.pitch = -0.08; BOT.press('forward', true); if (o.sprint) BOT.press('sprint', true);
      H.step(2);
      if (o.until && o.until()) break;
      const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
      if (d < (i === path.length - 1 ? (o.r || 1.2) : 1.0)) { i++; stuck = 0; }
      if (n % 45 === 0) { if (P.speed < 0.3 || Math.abs(lastD - d) < 0.05) { stuck++; if (P.stance === 'stand') BOT.tap('vault'); if (stuck > 3) { path = IV.nav.path(P.pos.x, P.pos.z, x, z) || path; i = 0; stuck = 0; } } lastD = d; }
    }
    BOT.press('forward', false); BOT.press('sprint', false); H.step(2);
    return Math.hypot(x - P.pos.x, z - P.pos.z) < (o.r || 1.2) + 1.5;
  }
  function use(sec) { BOT.press('use', true); H.step(Math.ceil(sec * 60) + 10); BOT.press('use', false); H.step(5); }
  function stance(s) { BOT.stance(s); }
  function snap() { const s = H.snapshot(); return { t: s.time.toFixed(0), phase: s.phase, p: [s.p.x | 0, s.p.z | 0, s.p.hp, s.p.stance], objs: s.objs.filter(o => o.endsWith('active')).join(','), alive: s.enemies.filter(e => e.alive).length, combat: s.enemies.filter(e => e.alive && e.s === 'combat').length, spotted: IV.ai.spottedCount }; }
  return { visible, fight, go, use, stance, snap };
})();
`;
