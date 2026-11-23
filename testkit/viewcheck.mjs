// Viewmodel framing and hands, desktop 960x540 (argv[3] = WxH to override): per weapon and state (hip, aimed, sprint,
// reload mid-way, crouch, prone, walking) the arms pass's screen coverage (% of pixels), whether an elbow or the cut
// upper arm is on screen, a full still, and close-ups of each hand (the arms scene through a narrow camera).
import fs from 'fs';
import { open, waitState, OUT } from './lib.mjs';
const label = process.argv[2] || 'before';
const [vw, vh] = (process.argv[3] || '960x540').split('x').map(Number);
const states = (process.env.STATES || 'hip,aim,sprint,reload,crouch,prone').split(',');
const close = !process.env.NOCLOSE;
const { browser, page, errors } = await open({ viewport: { width: vw, height: vh }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: { quality: +(process.env.Q || 1) }, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
fs.mkdirSync(`${OUT}/stills/${label}`, { recursive: true });
await page.evaluate(([cw, ch]) => {
  __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, W = IV.world;
  IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true;
  IV.settings.view = 'first'; IV.settings.fov = 74;
  for (const k of ['rifle', 'smg', 'pistol']) IV.weapons.has[k] = true;
  const S = window.__VC = {};
  S.full = (n = 1) => { for (let i = 0; i < n; i++) { __IV__.step(1); if (i === n - 1) __IV__.render(); else { IV.player.frame(1, 1 / 60); IV.camera.frame(1 / 60); } } };
  let rt = null;
  S.cover = () => {
    const VM = IV.fp.vm(); if (!VM || !VM.root.visible) return null; const r = W.renderer;
    rt = rt || new THREE.WebGLRenderTarget(cw, ch);
    VM.cam.aspect = cw / ch; VM.cam.fov = IV.fp.vmTune.fov; VM.cam.updateProjectionMatrix();
    const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), ac = r.autoClear;
    r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(true, true, true); r.autoClear = false; r.render(VM.scene, VM.cam);
    const buf = new Uint8Array(cw * ch * 4); r.readRenderTargetPixels(rt, 0, 0, cw, ch, buf); r.setRenderTarget(null); r.setClearColor(cc, ca); r.autoClear = ac;
    let n = 0; for (let i = 3; i < buf.length; i += 4) if (buf[i] > 8) n++;
    return +(n / (cw * ch) * 100).toFixed(1);
  };
  S.bones = () => {
    const VM = IV.fp.vm(), v = VM.rig.vm, o = {}; if (!v) return o;
    VM.cam.aspect = cw / ch; VM.cam.updateProjectionMatrix();
    for (const n of ['lowerarm_l', 'lowerarm_r', 'upperarm_l', 'upperarm_r']) { const b = v.bones[n]; if (!b) continue; const p = b.getWorldPosition(new THREE.Vector3()); const q = p.clone().project(VM.cam); const x = (q.x + 1) / 2 * cw, y = (1 - q.y) / 2 * ch; o[n] = { onScreen: p.z < 0 && x > -20 && x < cw + 20 && y > -20 && y < ch + 20, px: [Math.round(x), Math.round(y)] }; }
    return o;
  };
  S.closeup = (bone, fov) => {
    const VM = IV.fp.vm(), v = VM.rig.vm, r = W.renderer; const b = v.bones[bone]; if (!b) return null;
    const c = VM.cam.clone(); c.fov = fov || 16; c.aspect = cw / ch; c.updateProjectionMatrix(); c.lookAt(b.getWorldPosition(new THREE.Vector3())); c.updateMatrixWorld(true);
    const ac = r.autoClear, cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(); r.setRenderTarget(null); r.setClearColor(0x30343a, 1); r.clear(true, true, true); const tm = r.toneMapping; r.toneMapping = THREE.ACESFilmicToneMapping; r.render(VM.scene, c); r.toneMapping = tm; r.setClearColor(cc, ca); r.autoClear = ac;
    return r.domElement.toDataURL('image/jpeg', 0.9);
  };
  S.still = () => W.renderer.domElement.toDataURL('image/jpeg', 0.88);
}, [vw, vh]);
const res = {};
for (const k of (process.env.WEAPONS || 'rifle,smg,pistol').split(',')) {
  for (const st of states) {
    const r = await page.evaluate(([k, st, close]) => {
      const IV = __IV__.IV, P = IV.player, WP = IV.weapons, S = __VC;
      P.setStance('stand'); S.full(40); __IV__.teleport(0, 120, 0); P.yaw = 0; P.pitch = 0.03; WP.equip(k); WP.inv[k].mag = 3; WP.inv[k].res = 30;
      if (st === 'crouch') P.setStance('crouch'); if (st === 'prone') P.setStance('prone');
      S.full(st === 'prone' ? 120 : 70);
      if (st === 'aim') { __IV__.press('aim', true); S.full(25); }
      if (st === 'sprint') { __IV__.press('forward', true); __IV__.press('sprint', true); S.full(60); }
      if (st === 'reload') { __IV__.press('reload', true); S.full(1); __IV__.press('reload', false); const L = IV.fp.clipLen('reload', k) || 2; S.full(Math.round(L * 60 * 0.45)); }
      const o = { cover: S.cover(), bones: S.bones(), vmVisible: IV.fp.vm().root.visible, still: S.still() };
      if (close && o.vmVisible) { o.handR = S.closeup('hand_r', 18); o.handL = S.closeup('hand_l', 18); }
      __IV__.press('aim', false); __IV__.press('forward', false); __IV__.press('sprint', false);
      S.full(1);
      return o;
    }, [k, st, close]);
    for (const s of ['still', 'handR', 'handL']) if (r[s]) { fs.writeFileSync(`${OUT}/stills/${label}/${k}-${st}${s === 'still' ? '' : '-' + s}.jpg`, Buffer.from(r[s].split(',')[1], 'base64')); delete r[s]; }
    res[k + '.' + st] = r;
    console.log(k, st, JSON.stringify(r));
  }
}
fs.writeFileSync(`${OUT}/viewcheck-${label}-${vw}x${vh}.json`, JSON.stringify(res, null, 1));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
