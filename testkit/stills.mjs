// fixed-camera reference stills, simulation paused, Math.random seeded: node stills.mjs <quality 0|1|2> <tag> [missions]
// writes OUT/stills/<tag>/q<q>-<mission>-<view>.png (canvas only, no HUD) and OUT/stills/<tag>/q<q>.json (calls, tris, programs)
import { open, waitState, OUT } from './lib.mjs';
import fs from 'fs';
const q = +(process.argv[2] || 1), tag = process.argv[3] || 'x', only = (process.argv[4] || 'bootcamp,nightdrop').split(','), vonly = (process.argv[5] || '').split(',').filter(Boolean);
const dir = OUT + '/stills/' + tag; fs.mkdirSync(dir, { recursive: true });
const { browser, page, errors } = await open({ viewport: { width: 960, height: 540 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: { quality: q }, cp: null, tut: true }) } });
await page.addInitScript(() => { let s = 12345; const r = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; Math.random = r; window.__reseed = (n) => { s = n; }; });
await page.reload({ waitUntil: 'domcontentloaded' });
await waitState(page, 'menu', 1200000);
// the site-wide autores.js scales the canvas by measured frame time (on under ?test, where the game's governor is off):
// off, so every still is drawn at the full 960x540
await page.evaluate(() => { if (window.AutoRes) AutoRes.off(); __IV__.IV.world.resize(); });
const V = {
  bootcamp: [
    ['wide', { cam: [-30, 22, 190], at: [10, 0, 110] }], ['street', { cam: [0, 1.7, 152], at: [0, 1.4, 115] }],
    ['interior', { cam: [19.5, 1.9, 141.5], at: [12, 1.4, 139.5] }], ['foliage', { cam: [-42, 1.7, 134], at: [-48, 3.0, 137.5] }],
    ['puddle', { cam: [0, 1.3, 74], at: [0, 0, 70] }], ['ground', { cam: [1.6, 1.1, 24.2], at: [0, 0, 22] }],
    ['range', { cam: [0, 1.7, 46], at: [0, 1, 20] }], ['char', { spawn: [4, 152] }],
    ['fp-hip', { fp: [0, 150, Math.PI] }], ['fp-aim', { fp: [0, 150, Math.PI], aim: 1 }]],
  nightdrop: [
    ['wide', { cam: [70, 14, -40], at: [100, 0, -85] }], ['lane', { cam: [-60, 1.7, 19], at: [-80, 1.4, 19] }],
    ['yard', { cam: [90, 1.7, -60], at: [104, 0.5, -72] }], ['interior', { room: ['hall', 'kitchen'] }], ['foliage', { cam: [38, 1.7, -84], at: [48, 2.2, -86] }],
    ['puddle', { cam: [105.8, 1.2, -68.5], at: [104, 0, -70] }], ['char', { ent: 'g1' }],
    ['fp-hip', { fp: [96, -64, -1.2] }], ['fp-aim', { fp: [96, -64, -1.2], aim: 1 }]]
};
const meta = {};
for (const m of only) {
  await page.evaluate(m => { __reseed(777); __IV__.start(m, 0); }, m); await waitState(page, 'play', 900000);
  const c = await page.evaluate(() => { __IV__.pauseLoop(true); const IV = __IV__.IV, W = IV.world; IV.mission.on = false; IV.player.cine = null; IV.player.frozen = false; IV.ai.ignorePlayer = true;
    W.renderer.info.autoReset = false; if (window.AutoRes) AutoRes.off(); W.resize(); __IV__.step(10); __IV__.render(); const t = performance.now(); W.renderer.compile(W.scene, W.camera); return { compileMs: Math.round(performance.now() - t), programs: W.renderer.info.programs.length }; });
  console.log(m, 'compile', JSON.stringify(c));
  for (const [name, v] of V[m]) {
    if (vonly.length && !vonly.includes(name)) continue;
    const setup = await page.evaluate(([name, v]) => {
      __reseed(4242); const IV = __IV__.IV, W = IV.world, P = IV.player, M = IV.mission;
      const gy = (x, z) => W.height(x, z);
      let note = '';
      IV.camera.override = null; __IV__.press('aim', false);
      if (v.fp) { __IV__.teleport(v.fp[0], v.fp[1], v.fp[2]); P.pitch = -0.05; try { IV.weapons.equip('smg'); } catch (e) {} if (v.aim) __IV__.press('aim', true); __IV__.step(40); return 'fp'; }
      let cam, at;
      if (v.cam) { cam = [v.cam[0], gy(v.cam[0], v.cam[2]) + v.cam[1], v.cam[2]]; at = [v.at[0], gy(v.at[0], v.at[2]) + v.at[1], v.at[2]]; }
      if (v.room) { const a = M.rooms[v.room[0]], b = M.rooms[v.room[1]], fy = (M.houseFy != null ? M.houseFy : gy(a[0], a[1]) + 0.3); cam = [a[0], fy + 1.6, a[1]]; at = [b[0], fy + 1.1, b[1]]; note = 'floor ' + fy.toFixed(2); }
      if (v.tree) { const mm = new THREE.Matrix4(), p = new THREE.Vector3(), sp = new THREE.Sphere(); let best = null;
        const anc = o => { let a = o, n = ''; while (a) { n += ' ' + (a.name || ''); a = a.parent; } return n; };
        W.scene.traverse(o => { if (!o.isMesh || !o.visible) return; const n = anc(o); if (!/tree|hedge|foliage|bush|scatter/i.test(n) || /grass|skirt/i.test(n) || /^merged/.test(o.name || '')) return;
          const cand = (x, y, z, tag) => { const d = Math.hypot(x - v.tree[0], z - v.tree[1]); if (!best || d < best[3]) best = [x, y, z, d, tag]; };
          o.updateMatrixWorld();
          if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mm); p.setFromMatrixPosition(mm).applyMatrix4(o.matrixWorld); cand(p.x, p.y, p.z, n.trim().slice(0, 40)); } }
          else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); sp.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld); if (sp.radius < 12) cand(sp.center.x, sp.center.y - 2, sp.center.z, n.trim().slice(0, 40)); } });
        if (!best) return 'NO TREE';
        const dx = v.tree[0] - best[0], dz = v.tree[1] - best[2], L = Math.hypot(dx, dz) || 1; cam = [best[0] + dx / L * 4.5, gy(best[0] + dx / L * 4.5, best[2] + dz / L * 4.5) + 1.6, best[2] + dz / L * 4.5]; at = [best[0], best[1] + 2.4, best[2]]; note = 'tree ' + best.slice(0, 3).map(x => x.toFixed(1)).join(',') + ' ' + best[4]; }
      if (v.spawn) { if (!IV.__spawned) { IV.__spawned = IV.ai.spawn({ kind: 'ally', weapon: 'smg', x: v.spawn[0], z: v.spawn[1], yaw: 0, noShoot: true, fixed: true, name: 'still' }); IV.__spawned.hp = 9999; } __IV__.step(30); }
      if (v.ent || v.spawn) { const e = v.spawn ? IV.__spawned : IV.ai.list.find(e => e.name === v.ent || e.id === v.ent); if (!e) return 'NO ENT'; const ex = e.pos.x, ez = e.pos.z, ey = e.pos.y; cam = [ex + 1.5, ey + 1.6, ez + 1.6]; at = [ex, ey + 1.3, ez]; note = 'ent ' + ex.toFixed(2) + ',' + ez.toFixed(2); }
      IV.camera.override = (c) => { c.position.set(cam[0], cam[1], cam[2]); c.lookAt(at[0], at[1], at[2]); c.fov = 60; c.updateProjectionMatrix(); };
      // the player stands out of the shot where the camera is free
      __IV__.teleport(cam[0] + 0.01, cam[2] + 0.01); __IV__.step(2);
      return note || 'cam';
    }, [name, v]);
    // render, give the time-throttled updaters (trees 250 ms, buildings 200 ms, grass jobs) real time, render again
    for (let k = 0; k < 4; k++) { await page.evaluate(() => { __IV__.render(); }); await page.waitForTimeout(350); }
    const r = await page.evaluate(() => { const W = __IV__.IV.world, R = W.renderer; __IV__.render(); R.info.reset(); __IV__.render(); const i = R.info.render;
      return { size: [R.domElement.width, R.domElement.height], scene: window.IVEnv && IVEnv.sceneInfo, calls: i.calls, tris: i.triangles, programs: R.info.programs.length, shot: R.domElement.toDataURL('image/png') }; });
    fs.writeFileSync(`${dir}/q${q}-${m}-${name}.png`, Buffer.from(r.shot.split(',')[1], 'base64'));
    meta[`${m}-${name}`] = { setup, size: r.size, scene: r.scene, calls: r.calls, tris: r.tris, programs: r.programs };
    console.log(m, name, setup, r.size.join('x'), 'scene', JSON.stringify(r.scene), 'calls', r.calls, 'tris', r.tris, 'programs', r.programs);
  }
  await page.evaluate(() => { const IV = __IV__.IV; IV.camera.override = null; __IV__.press('aim', false); IV.__spawned = null; IV.world.renderer.info.autoReset = true; __IV__.pauseLoop(false); IV.app.quit(); }); await page.waitForTimeout(1500);
}
fs.writeFileSync(`${dir}/q${q}.json`, JSON.stringify({ meta, errors }, null, 1));
const shaderErr = errors.filter(e => /shader|WebGLProgram|compile|link|VALIDATE_STATUS|patch/i.test(e));
console.log('shader/patch errors:', shaderErr.length, shaderErr.slice(0, 4).map(e => e.slice(0, 400)).join('\n'));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).map(e => e.slice(0, 300)).join('\n') || 'none');
await browser.close();
