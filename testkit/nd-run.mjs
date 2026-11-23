// Night Drop bot. argv[2] = 'stealth' | 'loud'
import { open, waitState, OUT, snap } from './lib.mjs';
import { BOT } from './bot.mjs';
import { NDBOT } from './ndbot.mjs';
const mode = process.argv[2] || 'stealth';
const { browser, page, errors } = await open({ viewport: { width: 1280, height: 720 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: {}, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('nightdrop', 0)); await waitState(page, 'play');
await page.evaluate(() => __IV__.pauseLoop(true)); await page.evaluate(BOT); await page.evaluate(NDBOT);
// where each 'spotted' happens: the soldier, the player, the phase, and whether the line between them is clear
await page.evaluate(() => { window.__SPOT = []; const IV = __IV__.IV, P = IV.player, W = IV.world; IV.on('hurt', h => { window.__HURT = { t: +IV.mission.time.toFixed(1), me: P.pos.x.toFixed(1) + ',' + P.pos.z.toFixed(1), from: h.from ? h.from.x.toFixed(1) + ',' + h.from.z.toFixed(1) : '?', hp: Math.round(P.hp) }; }); IV.on('playerDied', () => { (window.__DIED = window.__DIED || []).push(Object.assign({ phase: IV.mission.phase }, window.__HURT)); }); IV.on('spotted', e => { const ey = e.pos.y + 1.6, py = P.pos.y + (P.stance === 'stand' ? 1.5 : P.stance === 'crouch' ? 1.0 : 0.35); window.__SPOT.push({ t: +IV.mission.time.toFixed(0), phase: IV.mission.phase, by: (e.name || e.kind) + '@' + e.pos.x.toFixed(1) + ',' + e.pos.z.toFixed(1) + ',' + e.pos.y.toFixed(1), me: P.pos.x.toFixed(1) + ',' + P.pos.z.toFixed(1) + ',' + P.pos.y.toFixed(1) + ' ' + P.stance, d: +Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z).toFixed(1), groundY: [W.height(e.pos.x, e.pos.z).toFixed(2), W.height(P.pos.x, P.pos.z).toFixed(2)] }); }); });
const R = (f, a) => page.evaluate(f, a);
const log = async m => { console.log(m.padEnd(10), JSON.stringify(await R(() => ND.snap()))); if (m === 'house') console.log('  left:', JSON.stringify(await R(() => BOT.IV.ai.list.filter(e => e.alive).map(e => (e.name || e.kind) + ' ' + e.state + ' @' + e.pos.x.toFixed(1) + ',' + e.pos.z.toFixed(1) + ',' + e.pos.y.toFixed(1) + ' cover=' + (e.cover ? e.cover.x.toFixed(1) + ',' + e.cover.z.toFixed(1) : '-') + ' tok=' + (BOT.IV.ai.tokens && BOT.IV.ai.tokens.has ? BOT.IV.ai.tokens.has(e) : '?'))))); };
const shot = async n => snap(page, OUT + '/' + n + '.png').catch(() => console.log('  (screenshot timed out: ' + n + ')'));
let deaths = 0;
async function guard(fn, name) { // run a phase; if the player dies, retry from the checkpoint like a player would (max 3)
  for (let a = 0; a < 4; a++) {
    await R(fn);
    const s = await R(() => ({ alive: BOT.P.alive, failed: BOT.IV.mission.failed }));
    if (s.alive && !s.failed) return true;
    deaths++; console.log('  died in', name, '- retrying from checkpoint');
    await R(() => { BOT.H.step(200); }); await waitState(page, 'results', 30000).catch(() => {}); await page.evaluate(() => __IV__.IV.app.retry(true)); await waitState(page, 'play'); await R(() => { __IV__.pauseLoop(true); BOT.H.step(30); });
  }
  return false;
}
await R(() => { BOT.H.step(90); ND.use(1.3); BOT.H.step(150); }); await log('cut');
await R(() => { ND.go(-92, 47, { r: 2, sprint: true }); BOT.H.step(400); }); await log('linked');
// phase-driven: look at where the mission is and do the next thing; on death, retry from the checkpoint like a player
const STEALTH = mode === 'stealth'; await page.evaluate(s => { window.STEALTH = s; }, STEALTH);
for (let it = 0; it < 40 && deaths < 6; it++) {
  const st = await R(() => ({ phase: BOT.IV.mission.phase, wire: !!BOT.IV.mission.flags.wire, done: BOT.IV.mission.finished, failed: BOT.IV.mission.failed, alive: BOT.P.alive, blown: !!BOT.IV.mission.flags.blown }));
  if (st.done) break;
  if (st.failed || !st.alive) { deaths++; console.log('  died (' + st.phase + ') - retrying from checkpoint'); await R(() => BOT.H.step(200)); await waitState(page, 'results', 30000).catch(() => {}); await page.evaluate(() => __IV__.IV.app.retry(true)); await waitState(page, 'play'); await R(() => { __IV__.pauseLoop(true); BOT.H.step(30); }); continue; }
  if ((st.phase === 'approach' || st.phase === 'link') && !st.wire) {
    if (STEALTH) await R(() => { ND.stance('crouch'); ND.go(-92, 33, { r: 1.5, fight: false }); ND.go(-95, 12, { r: 2, fight: false }); ND.go(-62, -12, { r: 2, fight: false }); ND.go(-44, -24, { r: 2, fight: false }); ND.go(-41, -35, { r: 1.2, fight: false }); ND.go(-30, -45, { r: 2, fight: false }); ND.go(-2, -76, { r: 2, fight: false }); ND.go(14, -76, { r: 2, fight: false }); ND.go(28, -80, { r: 1.5, fight: false }); ND.go(24, -52, { r: 1.5, fight: false }); });
    else await R(() => { ND.go(-60, 22, { r: 2, loud: true, sprint: true }); ND.go(-10, 12, { r: 2, loud: true }); ND.go(4, 0, { r: 2, loud: true }); ND.go(30, -46, { r: 2, loud: true, sprint: true }); });
    await R(() => { ND.go(36.8, -48.3, { r: 0.6, fight: !STEALTH, loud: true }); BOT.face(37.4, -47.4); ND.use(2.3); BOT.H.step(200); });
    await log('wire'); if (it === 0) await shot('nd-' + mode + '-wire');
  } else if (st.phase === 'approach' || st.phase === 'overwatch') {
    if (STEALTH) await R(() => { ND.stance('crouch'); ND.go(24, -52, { r: 1.5, fight: false }); ND.go(24, -118, { r: 1.5, fight: false }); ND.go(60, -124, { r: 1.5, fight: false, dark: true }); ND.go(80, -142, { r: 1.5, fight: false, dark: true }); ND.go(120, -141, { r: 1.5, fight: false, dark: true }); ND.go(120, -133, { r: 1.0, fight: false, dark: true }); ND.go(107, -125, { r: 1.0, fight: false, dark: true });
      const ld = BOT.IV.mission.E.ld; for (let i = 0; i < 30 && ld && ld.alive; i++) { const f = BOT.IV.fwd(ld.bodyYaw); ND.go(ld.pos.x - f.x * 1.1, ld.pos.z - f.z * 1.1, { r: 0.5, fight: false, max: 60 }); if (BOT.IV.weapons.takedownTarget === ld) { BOT.tap('knife'); BOT.H.step(110); } } });
    else await R(() => { ND.go(40, -72, { r: 2, loud: true }); BOT.H.step(200); ND.fight(900, false); ND.go(75, -98, { r: 2, loud: true }); ND.fight(900, false); { const g = BOT.IV.mission.E.mg; if (g && g.alive) { ND.go(89, -105.5, { r: 1, loud: true }); ND.stance('stand'); for (let i = 0; i < 25 && g.alive && BOT.P.alive; i++) { const sp = []; BOT.IV.weapons.spheres(g, sp); const h = sp.find(x => x[4] === 'head') || sp[0]; BOT.shootAt(h[0], h[1], h[2], 3, true); } } } ND.go(98, -120, { r: 2, loud: true }); ND.fight(900, false); });
    await R(() => { ND.go(100.6, -118.6, { r: 0.6, fight: !STEALTH, loud: true }); BOT.face(102, -117); ND.use(3.3); BOT.H.step(240); });
    await log('charge'); await shot('nd-' + mode + '-alarm');
  } else if (st.phase === 'loud' || st.phase === 'breach') {
    await R(() => { ND.stance('crouch'); ND.fight(900, true); const d = BOT.IV.mission.houseDoorN; ND.go(d.x + 0.9, d.z - 1.2, { r: 0.7, crouchFight: true }); BOT.H.step(60); ND.use(0.7); BOT.H.step(60); ND.stance('stand');
      const R2 = BOT.IV.mission.rooms; for (const k of ['hall', 'kitchen', 'parlour', 'hall', 'office', 'bedroom', 'hall']) { ND.go(R2[k][0], R2[k][1], { r: 1.2, loud: true }); ND.fight(600, false); }
      const m = BOT.IV.mission.mapPos; if (m && BOT.IV.mission.objs.some(o => o.id === 'map' && o.state === 'active')) { ND.go(m.x - 0.2, m.z + 0.9, { r: 0.6, loud: true }); ND.use(1.4); }
      BOT.H.step(120); });
    await log('house'); await shot('nd-' + mode + '-house');
  } else if (st.phase === 'hold') {
    await R(() => { ND.go(116, -66, { r: 1.5, loud: true }); ND.stance('crouch'); for (let i = 0; i < 70 && !BOT.IV.mission.flags.blown && BOT.P.alive; i++) { ND.fight(300, false); BOT.H.step(60); } BOT.H.step(200); });
    await log('blown'); await shot('nd-' + mode + '-after-explosion');
  } else if (st.phase === 'run') {
    await R(() => { ND.stance('stand'); for (const p of [[118, -52], [127, -32], [134, 0], [143, 38], [155, 72], [166, 90]]) ND.go(p[0], p[1], { r: 2, loud: true, sprint: true }); BOT.H.step(400); });
    await log('run');
  } else await R(() => BOT.H.step(120));
}
await log('end');
const fin = await R(() => __IV__.snapshot());
console.log('DIED', JSON.stringify(await R(() => window.__DIED || [])));
console.log('SPOTTED', JSON.stringify(await R(() => window.__SPOT), null, 0));
console.log('RESULT', mode, 'done=' + fin.done, 'failed=' + fin.failed, 'deaths=' + deaths, 'spottedEarly=' + (fin.flags.spottedEarly || 0), 'time=' + fin.time.toFixed(0));
await page.evaluate(() => __IV__.pauseLoop(false)); await page.waitForTimeout(3000);
await page.screenshot({ path: OUT + '/nd-' + mode + '-results.png', timeout: 60000 }).catch(() => {});
console.log(errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n'));
await browser.close();
