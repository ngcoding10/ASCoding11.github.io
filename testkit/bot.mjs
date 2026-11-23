// shared bot helpers, run inside the page (installed with page.evaluate(BOT))
export const BOT = `
window.BOT = (() => {
  const H = __IV__, IV = H.IV, P = IV.player, W = IV.world;
  const press = (id, on) => H.press(id, on);
  const tap = (id) => { press(id, true); H.step(2); press(id, false); H.step(1); };
  const cam = (n) => { for (let i = 0; i < (n || 6); i++) H.render(); };
  function face(x, z, y) { const dx = x - P.pos.x, dz = z - P.pos.z; P.yaw = IV.yawTo(dx, dz); if (y != null) { const ey = P.eyeY(); P.pitch = Math.atan2(y - ey, Math.hypot(dx, dz)); } }
  // walk along the nav path to (x,z); opts: {sprint, stance, r, max}
  function walkTo(x, z, o) {
    o = o || {}; const r = o.r || 1.2; let path = IV.nav.path(P.pos.x, P.pos.z, x, z) || [{ x, z }]; let i = 0, n = 0;
    if (o.direct) path = [{ x, z }];
    press('forward', true); if (o.sprint) press('sprint', true);
    while (n++ < (o.max || 6000)) {
      if (H.state() !== 'play' || !P.alive) break;
      const p = path[i]; if (!p) break;
      face(p.x, p.z); P.pitch = -0.1;
      H.step(2);
      if (o.until && o.until()) break;
      if (Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < (i === path.length - 1 ? r : 1.0)) i++;
      if (n % 60 === 0 && P.speed < 0.3) { tap('vault'); path = IV.nav.path(P.pos.x, P.pos.z, x, z) || path; i = 0; }
    }
    press('forward', false); press('sprint', false); H.step(4);
    return Math.hypot(x - P.pos.x, z - P.pos.z) < r + 1;
  }
  function stance(s) { let g = 0; while (P.stance !== s && g++ < 6) { tap(s === 'stand' ? (P.stance === 'crouch' ? 'crouch' : 'vault') : s); H.step(20); } }
  // correct the aim so the camera's own ray (over the shoulder) passes through the point
  function aimCam(x, y, z) { for (let i = 0; i < 3; i++) { const c = W.camera.position, d = IV.camera.lookDir; P.yaw += IV.wrapA(IV.yawTo(x - c.x, z - c.z) - IV.yawTo(d.x, d.z)); P.pitch += Math.atan2(y - c.y, Math.hypot(x - c.x, z - c.z)) - Math.asin(Math.max(-1, Math.min(1, d.y))); cam(1); } }
  // aim at a world point and fire n shots (hip or aimed)
  function shootAt(x, y, z, n, aimed) {
    if (aimed) { press('aim', true); H.step(12); }
    for (let k = 0; k < (n || 1); k++) { face(x, z, y); H.step(1); cam(4); face(x, z, y); cam(1); aimCam(x, y, z); tap('fire'); H.step(8); }
    press('aim', false); H.step(4);
  }
  // rifle: solve yaw/pitch with the same ballistics as the game, from the scope, wind included
  function rifleSolve(tx, ty, tz) {
    const WP = IV.weapons, BL = IV.TUNING.ballistics, c = W.camera;
    let yaw = IV.yawTo(tx - c.position.x, tz - c.position.z), pitch = Math.atan2(ty - c.position.y, Math.hypot(tx - c.position.x, tz - c.position.z));
    for (let it = 0; it < 6; it++) {
      const d = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), up = new THREE.Vector3().crossVectors(right, d);
      const v = d.clone().applyAxisAngle(right, WP.zeroAngle);
      const b = { x: c.position.x - up.x * BL.sightHeight, y: c.position.y - up.y * BL.sightHeight, z: c.position.z - up.z * BL.sightHeight, vx: v.x * BL.v0, vy: v.y * BL.v0, vz: v.z * BL.v0, drag: BL.drag };
      const dt = 1 / 600, R = Math.hypot(tx - b.x, tz - b.z);
      for (let t = 0; t < 2; t += dt) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; WP.ballStep(b, dt, WP.wind); if (Math.hypot(b.x - c.position.x, b.z - c.position.z) >= R) break; }
      // correct by the miss, as angles
      pitch += Math.atan2(ty - b.y, R);
      const missYaw = IV.wrapA(IV.yawTo(tx - c.position.x, tz - c.position.z) - IV.yawTo(b.x - c.position.x, b.z - c.position.z));
      yaw += missYaw;
    }
    return { yaw, pitch };
  }
  return { cam, press, tap, face, walkTo, stance, shootAt, rifleSolve, H, IV, P, W };
})();
`;
