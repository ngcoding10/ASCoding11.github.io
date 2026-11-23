// what world meshes are drawn within 1.5 m of the eye while aiming each gun (first person)
import { open, waitState } from './lib.mjs';
const { browser, page, errors } = await open({ viewport: { width: 640, height: 360 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: { quality: 0 }, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
const r = await page.evaluate(() => {
  __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, W = IV.world, WP = IV.weapons;
  IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true; IV.settings.view = 'first';
  __IV__.teleport(0, 120, 0); P.yaw = 0; P.pitch = 0.03;
  const out = {};
  const tick = n => { for (let i = 0; i < n; i++) { __IV__.step(1); IV.player.frame(1, 1 / 60); IV.camera.frame(1 / 60); } __IV__.render(); };
  for (const k of ['pistol', 'smg', 'rifle']) {
    WP.has[k] = true; WP.equip(k); tick(60);
    for (const aim of [false, true]) {
      __IV__.press('aim', aim); tick(30);
      const cp = W.camera.position, list = [];
      W.scene.traverse(o => {
        if (!o.isMesh || !o.visible) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (!v) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || m.colorWrite === false) return;
        o.geometry.computeBoundingSphere && !o.geometry.boundingSphere && o.geometry.computeBoundingSphere();
        const c = o.geometry.boundingSphere ? o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld) : o.getWorldPosition(new THREE.Vector3());
        const d = c.distanceTo(cp); if (d > 1.5) return;
        const path = []; for (let p = o; p && path.length < 6; p = p.parent) path.push(p.name || p.type);
        list.push(d.toFixed(2) + ' ' + path.join(' < ') + ' mat=' + (m.name || m.type) + (o.isSkinnedMesh ? ' skinned' : ''));
      });
      out[k + (aim ? '.aim' : '.hip')] = { list, held: P.actor && P.actor.held && P.actor.held.name, fpKey: IV.fp._fpKey };
    }
    __IV__.press('aim', false); tick(20);
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
