// smoke at a quality (argv[2]): both missions load and play, and a still of brick and stone walls in each (walls present)
import { open, waitState, OUT } from './lib.mjs';
import fs from 'fs';
const q = +(process.argv[2] || 1);
const { browser, page, errors } = await open({ viewport: { width: 960, height: 540 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: { quality: q }, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
for (const [m, tp, look] of [['bootcamp', [39, 64], [35, 75]], ['nightdrop', [0.8, 49], [-8.4, 57]]]) {
  await page.evaluate(m => __IV__.start(m, 0), m); await waitState(page, 'play', 600000);
  const r = await page.evaluate(([tp, look]) => {
    __IV__.pauseLoop(true); const IV = __IV__.IV, W = IV.world; IV.mission.on = false; IV.player.cine = null; IV.player.frozen = false;
    __IV__.teleport(tp[0], tp[1], IV.yawTo(look[0] - tp[0], look[1] - tp[1])); IV.player.pitch = 0.02; __IV__.step(30);
    W.renderer.compile(W.scene, W.camera);   // every material in the scene, in view or not, so any shader error shows
    for (let i = 0; i < 4; i++) __IV__.render();
    const s = __IV__.snapshot();
    return { st: s.state, mission: s.mission, shot: W.renderer.domElement.toDataURL('image/jpeg', 0.85) };
  }, [tp, look]);
  fs.writeFileSync(OUT + `/smoke-q${q}-${m}.jpg`, Buffer.from(r.shot.split(',')[1], 'base64'));
  console.log('quality', q, m, r.st);
  await page.evaluate(() => { __IV__.IV.mission.on = true; __IV__.IV.app.quit && __IV__.IV.app.quit(); }).catch(() => {});
}
const shaderErr = errors.filter(e => /shader|WebGLProgram|compile|link|VALIDATE_STATUS/i.test(e));
console.log(shaderErr.length ? 'FAIL shader errors: ' + shaderErr.length + '\n' + shaderErr.slice(0, 3).map(e => e.slice(0, 300)).join('\n') : 'shader errors: none');
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
