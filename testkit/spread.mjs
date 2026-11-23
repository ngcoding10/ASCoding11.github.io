// spread: the live cone while starting to jog from rest (hip SMG), the crosshair gap vs tan(spread) at the world FOV,
// and the first aimed standing shot's angle off the sight line (must be 0)
import { open, waitState } from './lib.mjs';
const { browser, page, errors } = await open({ viewport: { width: 800, height: 450 } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
const r = await page.evaluate(() => {
  __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, WP = IV.weapons, W = IV.world, H = IV.hud;
  IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true;
  __IV__.teleport(0, 120, 0); P.pitch = 0;
  WP.has.smg = true; WP.equip('smg');
  const fr = () => { __IV__.step(1); __IV__.render(); };
  for (let i = 0; i < 60; i++) fr();
  const curve = []; __IV__.press('forward', true);
  for (let i = 0; i < 48; i++) { fr(); if (i % 3 === 2) curve.push((P.speed.toFixed(1)) + ':' + (WP.currentSpread() * 1000).toFixed(1)); }
  __IV__.press('forward', false); for (let i = 0; i < 60; i++) fr();
  // crosshair gap check (hip, standing)
  const cv = document.getElementById('hudc'), u = cv.width / innerWidth, ppr = (cv.height / 2) / Math.tan(W.camera.fov * Math.PI / 360);
  const gapWant = Math.tan(WP.currentSpread()) * ppr / u + 3, gap = H.gap;
  // first aimed standing shot
  __IV__.teleport(0, 120, 0); P.pitch = 0.02; __IV__.press('aim', true); for (let i = 0; i < 40; i++) fr();
  const n0 = WP.bullets.length, d = IV.camera.lookDir.clone(), aim = WP.camRayPoint().clone(), cp = W.camera.position.clone();
  WP.inv.smg.mag = 30; __IV__.press('fire', true); __IV__.step(1); __IV__.press('fire', false);
  const b = WP.bullets[WP.bullets.length - 1];
  // angle between the bullet's start->aim point line and its velocity, and miss at the aim point
  const v = new THREE.Vector3(b.vx, b.vy, b.vz).normalize(), toAim = aim.clone().sub(new THREE.Vector3(b.x, b.y, b.z)).normalize();
  __IV__.press('aim', false);
  return { jogCurve_speed_mrad: curve.join(' '), gap: +gap.toFixed(2), gapFromSpread: +gapWant.toFixed(2), firstAimedShotOffSight_mrad: +(Math.acos(Math.min(1, v.dot(toAim))) * 1000).toFixed(3), bulletsAdded: WP.bullets.length - n0 };
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
