// Aim-down-sights measurements, first person, desktop 960x540: per weapon the raise (time to settled, path of the
// sights in px from the screen centre, gun angles), the settled sight picture, point of impact at 25/100 m, screen
// coverage of the arms pass (hip and aimed), FOV, sensitivity, release; then aim while walking, crouched, prone and
// straight after a sprint. Stills of hip and aimed. argv[2] = label (before/after).
import fs from 'fs';
import { open, waitState, OUT } from './lib.mjs';
const label = process.argv[2] || 'before';
const { browser, page, errors } = await open({ viewport: { width: +(process.env.VW || 960), height: +(process.env.VH || 540) }, touch: !!process.env.TOUCH, dpr: process.env.TOUCH ? 2 : 1, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: { quality: +(process.env.Q || 0) }, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
const setup = await page.evaluate(() => {
  __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, W = IV.world;
  IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true;
  IV.settings.view = 'first'; IV.settings.fov = 74; IV.settings.assist = 0;
  __IV__.teleport(0, 120, 0); P.pitch = 0.03;
  for (const k of ['rifle', 'smg', 'pistol']) { IV.weapons.has[k] = true; }
  const S = window.__AC = {};
  S.tick = (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) { __IV__.step(1); IV.player.frame(1, dt); IV.camera.frame(dt); } };
  S.full = (n = 1) => { for (let i = 0; i < n; i++) { __IV__.step(1); if (i === n - 1) __IV__.render(); else { IV.player.frame(1, 1 / 60); IV.camera.frame(1 / 60); } } };
  const cw = innerWidth, ch = innerHeight;
  S.aim = on => { const b = IV.touch && document.querySelector('[data-t="aim"]'); if (b) { if (b.classList.contains('on') !== !!on) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })); } else __IV__.press('aim', on); };
  S.px = v => { const VM = IV.fp.vm(); VM.cam.aspect = cw / ch; VM.cam.fov = IV.fp.vmTune.fov; VM.cam.updateProjectionMatrix(); const p = v.clone().project(VM.cam); return [(p.x + 1) / 2 * cw - cw / 2, (1 - p.y) / 2 * ch - ch / 2]; };
  S.sock = n => { const VM = IV.fp.vm(), v = VM.rig.vm; const o = v && v.sockets[n]; return o ? o.getWorldPosition(new THREE.Vector3()) : null; };
  S.sight = () => {
    const VM = IV.fp.vm(), v = VM.rig.vm; if (!v || !VM.root.visible) return null;
    const r = S.sock('sightRear') || S.sock('scopeEye'), f = S.sock('sightFront') || S.sock('muzzle');
    const wr = v.bones.w_root, q = wr.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), fw = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const d = f.clone().sub(r).normalize();
    return { rear: S.px(r).map(x => +x.toFixed(2)), front: S.px(f).map(x => +x.toFixed(2)), lineYaw: +(Math.atan2(d.x, -d.z) * 57.3).toFixed(2), linePitch: +(Math.asin(d.y) * 57.3).toFixed(2), roll: +(Math.atan2(up.x, up.y) * 57.3).toFixed(2), barrelYaw: +(Math.atan2(fw.x, -fw.z) * 57.3).toFixed(2), barrelPitch: +(Math.asin(fw.y) * 57.3).toFixed(2), rearZ: +r.z.toFixed(3) };
  };
  let rt = null;
  S.cover = () => {
    const VM = IV.fp.vm(); if (!VM || !VM.root.visible) return null; const r = W.renderer;
    rt = rt || new THREE.WebGLRenderTarget(cw, ch);
    VM.cam.aspect = cw / ch; VM.cam.fov = IV.fp.vmTune.fov; VM.cam.updateProjectionMatrix();
    const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), ac = r.autoClear;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(true, true, true); r.autoClear = false; r.render(VM.scene, VM.cam);
    const buf = new Uint8Array(cw * ch * 4); r.readRenderTargetPixels(rt, 0, 0, cw, ch, buf); r.setRenderTarget(null); r.setClearColor(cc, ca); r.autoClear = ac;
    let n = 0, nc = 0, x0 = cw, y0 = ch, x1 = 0, y1 = 0, cols = new Uint32Array(cw);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (buf[(y * cw + x) * 4 + 3] > 8) { n++; const yy = ch - 1 - y; if (x > cw * 0.4 && x < cw * 0.6 && yy > ch * 0.35 && yy < ch * 0.65) nc++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
    return { pct: +(n / (cw * ch) * 100).toFixed(1), centrePct: +(nc / (cw * ch * 0.06) * 100).toFixed(1), box: [x0, y0, x1, y1] };
  };
  S.sens = () => { const C = IV.camera, y0 = P.yaw; C.look(100, 0, false); const d = y0 - P.yaw; P.yaw = y0; return +(d * 1000).toFixed(2); };   // mrad per 100 px
  S.still = () => W.renderer.domElement.toDataURL('image/jpeg', 0.88);
  return 'ok';
});
const out = { label, weapons: {} };
for (const k of (process.env.WEAPONS || 'rifle,smg,pistol').split(',')) {
  const r = await page.evaluate(k => {
    const IV = __IV__.IV, P = IV.player, W = IV.world, C = IV.camera, WP = IV.weapons, FP = IV.fp, S = __AC;
    P.setStance('stand'); __IV__.teleport(0, 120, 0); P.yaw = 0; P.pitch = 0.03; WP.equip(k); WP.inv[k].mag = 5;
    S.full(70);
    const res = { weapon: k };
    res.hip = { sight: S.sight(), cover: S.cover(), fov: +W.camera.fov.toFixed(2), sens_mrad_per_100px: S.sens(), vmFov: FP.vmTune.fov };
    S.full(1); res.hipStill = S.still();
    // raise
    const y0 = P.yaw, p0 = P.pitch; const series = []; __AC.aim(true);
    for (let i = 1; i <= 40; i++) { S.tick(1); const s = S.sight(); series.push({ t: +(i / 60).toFixed(3), vmAim: +(FP.vmAim || 0).toFixed(3), fov: +W.camera.fov.toFixed(2), scope: !!C.scopeView, front: s && s.front, rear: s && s.rear, roll: s && s.roll, lineYaw: s && s.lineYaw, linePitch: s && s.linePitch }); }
    res.aimJump = { yaw_mrad: +((P.yaw - y0) * 1000).toFixed(2), pitch_mrad: +((P.pitch - p0) * 1000).toFixed(2) };
    const fin = series[series.length - 1];
    let settle = null;
    for (let i = series.length - 1; i >= 0; i--) { const s = series[i]; const ok = Math.abs(s.fov - fin.fov) < 0.1 && (!fin.front || (s.front && Math.hypot(s.front[0] - fin.front[0], s.front[1] - fin.front[1]) < 1)) && s.scope === fin.scope; if (!ok) { settle = series[i + 1] ? series[i + 1].t : null; break; } if (i === 0) settle = s.t; }
    res.settle_s = settle;
    res.series = series.filter((s, i) => i < 24 || i % 4 === 0).map(s => `${s.t}s aim ${s.vmAim} fov ${s.fov}${s.scope ? ' SCOPE' : ''} front ${s.front ? s.front.map(Math.round) : '-'} rear ${s.rear ? s.rear.map(Math.round) : '-'} roll ${s.roll} pitch ${s.linePitch} yaw ${s.lineYaw}`);
    S.full(20);
    res.aimed = { sight: S.sight(), cover: S.cover(), fov: +W.camera.fov.toFixed(2), sens_mrad_per_100px: S.sens(), scope: !!C.scopeView, vmVisible: FP.vm().root.visible };
    res.zoom = +(Math.tan(res.hip.fov * Math.PI / 360) / Math.tan(res.aimed.fov * Math.PI / 360)).toFixed(3);
    res.turnFeel = +((res.aimed.sens_mrad_per_100px / res.hip.sens_mrad_per_100px) * res.zoom).toFixed(3);   // 1 = the same screen-relative turn as the hip
    res.aimedStill = S.still();
    // point of impact: one aimed shot, the round where it crosses 25 m and 100 m along the view, in px from the centre
    const look = C.lookDir.clone(), cp = W.camera.position.clone(), n0 = WP.bullets.length;
    WP.cool = 0; WP.boltT = 0; __IV__.press('fire', true); __IV__.step(1); __IV__.press('fire', false);
    const b = WP.bullets[WP.bullets.length - 1]; const poi = {};
    if (b && WP.bullets.length > n0) {
      let prev = { x: b.x, y: b.y, z: b.z };
      for (let i = 0; i < 120 && b.alive !== false; i++) {
        const d0 = (prev.x - cp.x) * look.x + (prev.y - cp.y) * look.y + (prev.z - cp.z) * look.z;
        __IV__.step(1);
        const d1 = (b.x - cp.x) * look.x + (b.y - cp.y) * look.y + (b.z - cp.z) * look.z;
        for (const R of [25, 100]) if (!poi[R] && d0 < R && d1 >= R) { const t = (R - d0) / (d1 - d0); const p = new THREE.Vector3(prev.x + (b.x - prev.x) * t, prev.y + (b.y - prev.y) * t, prev.z + (b.z - prev.z) * t);
          // projected with the world camera as it was at the shot
          const q = p.clone().sub(cp); const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, look);
          const f = innerHeight / 2 / Math.tan(W.camera.fov * Math.PI / 360); poi[R] = { dx_px: +(q.dot(right) / q.dot(look) * f).toFixed(1), dy_px: +(-q.dot(up) / q.dot(look) * f).toFixed(1), cm: [+(q.dot(right) * 100).toFixed(1), +(q.dot(up) * 100).toFixed(1)] }; }
        prev = { x: b.x, y: b.y, z: b.z };
      }
    }
    res.poi = poi;
    // release
    S.full(30); const rel = []; __AC.aim(false);
    let prevF = null, maxStep = 0;
    for (let i = 1; i <= 30; i++) { S.tick(1); const s = S.sight(); if (s && prevF) maxStep = Math.max(maxStep, Math.hypot(s.front[0] - prevF[0], s.front[1] - prevF[1])); if (s) prevF = s.front; rel.push({ t: i / 60, vmAim: FP.vmAim, fov: W.camera.fov }); }
    const rDone = rel.find(s => s.vmAim < 0.01 && Math.abs(s.fov - res.hip.fov) < 0.1);
    res.release = { done_s: rDone ? +rDone.t.toFixed(3) : '>0.5', maxFrontStepPx: +maxStep.toFixed(1) };
    return res;
  }, k);
  for (const s of ['hipStill', 'aimedStill']) { fs.writeFileSync(`${OUT}/stills/${label}-${k}-${s.replace('Still', '')}.jpg`, Buffer.from(r[s].split(',')[1], 'base64')); delete r[s]; }
  out.weapons[k] = r;
  console.log(JSON.stringify(r, null, 1));
}
// states: walk, crouch, prone, straight after a sprint (SMG)
const st = await page.evaluate(() => {
  const IV = __IV__.IV, P = IV.player, W = IV.world, C = IV.camera, WP = IV.weapons, FP = IV.fp, S = __AC, I = IV.input;
  const res = {};
  WP.equip('smg'); S.full(30);
  const raise = () => { const t0 = []; __AC.aim(true); let tAim = null, tSet = null; const fr = []; for (let i = 1; i <= 60; i++) { S.tick(1); if (tAim == null && WP.aiming) tAim = i / 60; const s = S.sight(); fr.push(s ? s.front : null); if (tSet == null && FP.vmAim > 0.99) tSet = i / 60; } const last = fr.slice(-30).filter(Boolean); const dev = last.length ? Math.max(...last.map(f => Math.hypot(f[0], f[1]))) : null; __AC.aim(false); S.tick(40); return { aimOn_s: tAim, vmAim99_s: tSet, maxSightOffCentreLast0_5s_px: dev != null ? +dev.toFixed(1) : null }; };
  // walking: hip sway vs aimed sway
  __IV__.teleport(0, 120, 0); P.yaw = 0; __IV__.press('forward', true); S.tick(60);
  { const fr = []; for (let i = 0; i < 60; i++) { S.tick(1); const s = S.sight(); fr.push(s.front); } const mx = a => Math.max(...a) - Math.min(...a); res.walkHipSightRange_px = [+mx(fr.map(f => f[0])).toFixed(1), +mx(fr.map(f => f[1])).toFixed(1)]; }
  res.walk = raise();
  { __AC.aim(true); S.tick(30); const fr = []; for (let i = 0; i < 60; i++) { S.tick(1); fr.push(S.sight().front); } const mx = a => Math.max(...a) - Math.min(...a); res.walkAimSightRange_px = [+mx(fr.map(f => f[0])).toFixed(1), +mx(fr.map(f => f[1])).toFixed(1)]; __AC.aim(false); }
  __IV__.press('forward', false); S.tick(60);
  // look sway: turn at 3 rad/s for 0.3 s, then stop; how far the sight goes and how long it takes to settle
  for (const aimed of [false, true]) {
    if (aimed) { __AC.aim(true); S.tick(40); }
    const base = S.sight().front; const tr = [];
    for (let i = 0; i < 60; i++) { if (i < 18) C.look(3 / 60 / (0.0023 * (aimed ? IV.settings.aimSens : IV.settings.sens) * (C.fov / 68)), 0, false); S.tick(1); const f = S.sight().front; tr.push(+(f[0] - base[0]).toFixed(1)); }
    res[aimed ? 'lookSwayAimed_px' : 'lookSwayHip_px'] = { max: Math.max(...tr.map(Math.abs)), atStop: tr[17], after0_3s: tr[35], after0_7s: tr[59] };
    if (aimed) { __AC.aim(false); S.tick(40); }
  }
  P.setStance('crouch'); S.tick(60); res.crouch = raise();
  P.setStance('prone'); S.tick(120); res.prone = raise();
  P.setStance('stand'); S.tick(90);
  __IV__.press('forward', true); __IV__.press('sprint', true); S.tick(90); res.sprinting = P.sprinting;
  __IV__.press('sprint', false); res.afterSprint = raise(); __IV__.press('forward', false); S.tick(30);
  return res;
});
out.states = st;
console.log(JSON.stringify(st, null, 1));
fs.writeFileSync(`${OUT}/aimcheck-${label}.json`, JSON.stringify(out, null, 1));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
