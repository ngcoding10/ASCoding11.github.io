import { open, waitState, OUT, snap } from './lib.mjs';
import { BOT } from './bot.mjs';
const { browser, page, errors } = await open();
page.on('crash', () => console.log('PAGE CRASHED'));
page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('NAV', f.url()); });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0));
await waitState(page, 'play');
await page.evaluate(() => __IV__.pauseLoop(true));
await page.evaluate(BOT);
const log = async (m) => console.log(m, JSON.stringify(await page.evaluate(() => { const s = __IV__.snapshot(); return { t: s.time.toFixed(1), p: s.p, objs: s.objs.slice(-2) }; })));
const shot = async n => snap(page, OUT + '/' + n + '.png').catch(() => console.log('  (screenshot timed out: ' + n + ')'));
const R = (f, a) => page.evaluate(f, a);
await R(() => { BOT.H.step(30); BOT.walkTo(0, 132, { r: 2 }); }); await log('s1');
await R(() => { BOT.walkTo(0, 98, { r: 2, sprint: true }); }); await log('s2');
await shot('bc-crouch');
await R(() => { BOT.walkTo(0, 91, { r: 1 }); BOT.stance('crouch'); BOT.walkTo(0, 83, { r: 1, direct: true }); BOT.stance('stand'); }); await log('s3');
await R(() => { BOT.walkTo(0, 74, { r: 1 }); BOT.stance('prone'); BOT.walkTo(0, 62, { r: 1, direct: true }); BOT.stance('stand'); BOT.H.step(30); }); await log('s4');
await R(() => { BOT.walkTo(0, 56.6, { r: 0.6 }); BOT.face(0, 40); BOT.press('forward', true); BOT.H.step(10); BOT.tap('vault'); BOT.H.step(60); BOT.press('forward', false); BOT.H.step(10); }); await log('s5');
await R(() => { BOT.walkTo(0, 51, { r: 1 }); for (let i = 0; i < 600 && !BOT.IV.mission.objs.some(o => o.id === 's5b' && o.state === 'active'); i++) BOT.H.step(1); BOT.press('leanLeft', true); BOT.H.step(20); BOT.cam(4); BOT.press('leanLeft', false); BOT.press('leanRight', true); BOT.H.step(20); BOT.cam(4); BOT.press('leanRight', false); BOT.H.step(60); }); await log('s5b');
await R(() => { BOT.walkTo(-1, 37, { r: 1.5 }); BOT.H.step(60); });
await shot('bc-popups');
await R(() => { for (const t of BOT.IV.targets) for (let k = 0; k < 12 && t.alive; k++) BOT.shootAt(t.pos.x, t.pos.y + t.chestH(), t.pos.z, 1, true); BOT.H.step(60); }); await log('s6');
await R(() => { BOT.walkTo(0, 20.5, { r: 1.5 }); BOT.H.step(30); BOT.tap('rifle'); BOT.H.step(30); BOT.stance('prone'); BOT.H.step(40); }); await log('s7a');
const riflelog = await R(() => {
  const out = [];
  BOT.press('aim', true); BOT.H.step(30); BOT.cam(24);   // first person: the rifle comes up to the eye before the scope view starts
  for (const t of BOT.IV.targets.filter(t => t.steel)) {
    for (let k = 0; k < 3 && t.alive; k++) {
      BOT.cam(8); const s = BOT.rifleSolve(t.pos.x, t.pos.y + t.chestH(), t.pos.z);
      BOT.P.yaw = s.yaw; BOT.P.pitch = s.pitch; BOT.press('breath', true); BOT.H.step(20);
      // cancel sway for the bot by solving again on the swayed camera
      BOT.H.render(); const s2 = BOT.rifleSolve(t.pos.x, t.pos.y + t.chestH(), t.pos.z); BOT.P.yaw += s.yaw - s2.yaw + (s.yaw - s2.yaw) * 0; BOT.P.pitch += s.pitch - s2.pitch; BOT.H.render();
      BOT.tap('fire'); BOT.H.step(90); BOT.cam(20); out.push((t.pos.z | 0) + (t.alive ? ' miss' : ' hit'));
    }
  }
  BOT.press('breath', false); BOT.press('aim', false); BOT.H.step(20);
  return out;
});
console.log('rifle', riflelog.join(', '));
await log('s7');
await R(() => { BOT.stance('stand'); BOT.tap('smg'); BOT.H.step(60); BOT.walkTo(20, 24, { r: 1.5 }); BOT.stance('crouch'); BOT.walkTo(24, 14, { r: 1.5 }); BOT.H.step(60); }); await log('pen');
await R(() => { BOT.stance('crouch'); BOT.face(38, -16); BOT.P.pitch = 0.2; BOT.cam(6); BOT.press('rock', true); BOT.H.step(20); BOT.press('rock', false); BOT.H.step(120); });
console.log('guard', await R(() => { const g = BOT.IV.mission.guard; return g.state + ' ' + g.pos.x.toFixed(1) + ',' + g.pos.z.toFixed(1); }));
await R(() => { const { IV, P, H } = BOT, g = IV.mission.guard; for (let i = 0; i < 120 && g.alive && IV.mission.guard === g; i++) { const f = IV.fwd(g.bodyYaw), tx = g.pos.x - f.x, tz = g.pos.z - f.z; const pth = IV.nav.path(P.pos.x, P.pos.z, tx, tz); const wp = pth && pth[0] || { x: tx, z: tz }; BOT.face(wp.x, wp.z); const gd = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z); if (P.stance === 'stand') BOT.tap('crouch');   /* crouch all the way: with the 5 m/s jog the old 'jog until 11 m' rule arrives while he is still looking round and gets heard */ BOT.press('forward', true);  H.step(Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z) < 4 ? 2 : 10); if (IV.weapons.takedownTarget) { BOT.press('forward', false); BOT.tap('knife'); H.step(100); } } BOT.press('forward', false); BOT.press('sprint', false); H.step(60); });
await log('takedown');
console.log('state', await R(() => { const P = BOT.P, I = BOT.IV.input; return JSON.stringify({ frozen: P.frozen, cine: !!P.cine, cineClip: P.cineClip, vault: !!P.vault, stance: P.stance, speed: P.speed, mcine: !!(BOT.IV.mission && BOT.IV.mission.cine), lock: BOT.IV.lock || null, held: I && I.held ? Object.keys(I.held).filter(k => I.held[k]) : null, path: BOT.IV.nav.path(P.pos.x, P.pos.z, 0, 10) }); }));
await R(() => { BOT.stance('stand'); BOT.walkTo(0, 10, { r: 2 }); BOT.press('binoc', true); BOT.H.step(20); for (const e of BOT.IV.ai.list) { if (e.name === 'guard') continue; BOT.face(e.pos.x, e.pos.z, e.pos.y + 1.3); BOT.H.step(3); BOT.cam(3); BOT.tap('fire'); BOT.H.step(10); } BOT.press('binoc', false); BOT.H.step(60); });
await log('binoc');
console.log('state', await R(() => { const P = BOT.P, I = BOT.IV.input; return JSON.stringify({ frozen: P.frozen, cine: !!P.cine, cineClip: P.cineClip, vault: !!P.vault, stance: P.stance, speed: P.speed, mcine: !!(BOT.IV.mission && BOT.IV.mission.cine), lock: BOT.IV.lock || null, held: I && I.held ? Object.keys(I.held).filter(k => I.held[k]) : null, path: BOT.IV.nav.path(P.pos.x, P.pos.z, 0, 10) }); }));
await R(() => { BOT.walkTo(-10, 0, { r: 1.5 }); BOT.face(-18, -2); BOT.press('grenade', true); BOT.H.step(5); for (let k = 0; k < 40; k++) { BOT.P.pitch = 0.3 - k * 0.025; BOT.cam(1); const a = BOT.IV.weapons.arc(); const n = a.length; if (Math.hypot(a[n - 3] + 18, a[n - 1] + 2) < 1.5) break; } BOT.H.step(20); BOT.press('grenade', false); BOT.H.step(300); });
await log('grenade');
await R(() => BOT.H.step(400));
const s = await R(() => __IV__.snapshot());
console.log('final', s.done, s.state, s.objs.join(' '));
await page.evaluate(() => __IV__.pauseLoop(false)); await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '/bc-results.png' }).catch(() => {});
console.log(errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n'));
await browser.close();
