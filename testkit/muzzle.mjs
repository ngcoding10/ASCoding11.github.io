// muzzle point check: at world FOV 60/74/95, where the flash/tracer/case start (world point projected by the world
// camera) vs where the drawn muzzle is (viewmodel socket projected by the arms camera). MODE=before replays the old
// formula (z *= 0.9 only) from this test, MODE=after uses the game's FP.muzzle.
import fs from 'fs';
import { open, waitState, OUT } from './lib.mjs';
const mode = process.argv[2] || 'after';
const { browser, page, errors } = await open({ viewport: { width: 960, height: 540 } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
for (const fov of [60, 74, 95]) {
  const r = await page.evaluate(([fov, mode]) => {
    __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, FP = IV.fp, W = IV.world;
    IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true;
    IV.settings.view = 'first'; IV.settings.fov = fov;
    __IV__.teleport(0, 120, 0); P.pitch = 0.05;
    if (IV.weapons.cur !== 'smg') { IV.weapons.has.smg = true; IV.weapons.equip('smg'); }
    IV.weapons.inv.smg.mag = 30;
    if (mode === 'before' && !FP._mz0) { FP._mz0 = FP.muzzle; FP.muzzle = function (out) { const VM = FP.vm(); if (!VM || !VM.rig.muzzle || !VM.root.visible) return null; const m = VM.rig.muzzle.getWorldPosition(new THREE.Vector3()); m.applyMatrix4(VM.cam.matrixWorldInverse); m.z *= 0.9; return out.copy(m).applyMatrix4(W.camera.matrixWorld); }; }
    for (let k = 0; k < 90; k++) { __IV__.step(1); __IV__.render(); }
    IV.weapons.stats.shots = 2;   // the next round is a tracer
    __IV__.press('fire', true); __IV__.step(1); __IV__.press('fire', false); __IV__.render(); __IV__.step(1); __IV__.render();
    const VM = FP.vm(), cv = W.renderer.domElement, w = cv.width, h = cv.height;
    const a = VM.rig.muzzle.getWorldPosition(new THREE.Vector3()).project(VM.cam);
    const b = FP.muzzle(new THREE.Vector3()).project(W.camera);
    const ej = VM.rig.ejection ? VM.rig.ejection.getWorldPosition(new THREE.Vector3()).project(VM.cam) : null;
    const sx = v => (v.x + 1) / 2 * w, sy = v => (1 - v.y) / 2 * h;
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
    g.lineWidth = 2; g.strokeStyle = '#3f3'; g.beginPath(); g.arc(sx(a), sy(a), 9, 0, 7); g.stroke();
    g.strokeStyle = '#f33'; g.beginPath(); g.moveTo(sx(b) - 8, sy(b) - 8); g.lineTo(sx(b) + 8, sy(b) + 8); g.moveTo(sx(b) + 8, sy(b) - 8); g.lineTo(sx(b) - 8, sy(b) + 8); g.stroke();
    g.fillStyle = '#fff'; g.font = '16px sans-serif'; g.fillText(mode + ' fov ' + fov + ': green = drawn muzzle, red = world point (flash, tracer)', 10, h - 12);
    return { fov, camFov: +W.camera.fov.toFixed(1), drawn: [sx(a) | 0, sy(a) | 0], world: [sx(b) | 0, sy(b) | 0], px: +Math.hypot(sx(a) - sx(b), sy(a) - sy(b)).toFixed(1), shot: c2.toDataURL('image/jpeg', 0.88) };
  }, [fov, mode]);
  fs.writeFileSync(OUT + `/stills/muzzle-${process.env.TAG || mode}-fov${fov}.jpg`, Buffer.from(r.shot.split(',')[1], 'base64'));
  delete r.shot; console.log(mode, JSON.stringify(r));
}
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
