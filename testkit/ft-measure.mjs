// argv: diff sections(comma list: detect,acc,hide,cost,cost2,f1,f2,f3,f4) runs
import { boot } from './ft-boot.mjs';
const diff = +(process.argv[2] || 1), secs = (process.argv[3] || 'detect,acc,hide,cost,f1,f2,f3,f4').split(','), NS = +(process.argv[4] || 10);
const { browser, page, errors } = await boot(diff);
const R = (f, a) => page.evaluate(f, a);
console.log('DIFF', diff, await R(() => __IV__.IV.mission.diff));
if (secs.includes('detect')) {
  for (const lit of [false, true]) {
    const rows = [];
    for (let s = 1; s <= 8; s++) rows.push(await R(([s, lit]) => {
      FT.layout([]); FT.lamp(lit, 70, -150);
      FT.begin(s, { px: 70, pz: -150, enemies: [{ x: 70, z: -165, kind: 'rifleman' }] });
      const e = FT.enemies[0]; let seen = null, combat = null;
      FT.run(14, null, () => { if (seen == null && e.seeing) seen = FT.log().frames / 60; if (combat == null && e.state === 'combat') combat = FT.log().frames / 60; return FT.log().fire.some(f => f.at); });
      const f = FT.log().fire.find(f => f.at), t = FT.log().tele[0];
      return { seen, combat, tele: t ? +t.t.toFixed(2) : null, fire: f ? +f.t.toFixed(2) : null, sightToShot: f && seen != null ? +(f.t - seen).toFixed(2) : null, teleToShot: f && t ? +(f.t - t.t).toFixed(3) : null };
    }, [s, lit]));
    console.log('DETECT', lit ? 'lamp' : 'moon', JSON.stringify(rows));
  }
}
if (secs.includes('acc')) {
  for (const d of [10, 25, 50]) for (const mode of ['stand', 'crouch', 'walk', 'sprint']) {
    const r = await R(([d, mode, NS]) => {
      const IV = __IV__.IV, P = IV.player, early = { s: 0, h: 0 }, late = { s: 0, h: 0 }, dmg = [];
      for (let s = 1; s <= NS; s++) {
        FT.layout([]); FT.lamp(true, 70, -150);
        FT.begin(s, { px: 70, pz: -150, hp: 1e6, stance: mode === 'crouch' ? 'crouch' : 'stand', enemies: [{ x: 70, z: -150 - d, kind: 'rifleman', combat: true }] });
        let flip = 0, dir = 1;
        const ctl = (mode === 'walk' || mode === 'sprint') ? () => { flip += 1 / 60; if (flip > 1.6) { flip = 0; dir = -dir; } P.yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2; FT.move('forward', mode === 'sprint'); } : null;
        FT.run(8, ctl);
        const L = FT.log();
        for (const f of L.fire) { if (!f.at) continue; const hit = L.hurt.some(h => h.t >= f.t && h.t < f.t + 0.25); const b = f.seeT < 2.5 ? early : f.seeT >= 4 ? late : null; if (b) { b.s++; if (hit) b.h++; } }
        for (const h of L.hurt) dmg.push(h.dmg);
        FT.stop();
      }
      FT.lamp(false);
      return { d, mode, early: early.s ? +(early.h / early.s).toFixed(2) : null, earlyN: early.s, late: late.s ? +(late.h / late.s).toFixed(2) : null, lateN: late.s, dmg: dmg.length ? Math.round(dmg.reduce((a, b) => a + b, 0) / dmg.length) : null };
    }, [d, mode, NS]);
    console.log('ACC', JSON.stringify(r));
  }
}
if (secs.includes('hide')) {
  const rows = [];
  for (let s = 1; s <= 4; s++) rows.push(await R(s => {
    const IV = __IV__.IV, P = IV.player, AI = IV.ai;
    FT.layout(['ewall', 'side', 'hedge']);
    FT.begin(s, { px: 72, pz: -150, hp: 1e6, enemies: FT.squad(true) });
    const snaps = []; let t = 0;
    const ctl = () => { t += 1 / 60; if (t < 3) return; if (t < 18) { FT.setStance('crouch'); FT.walkTo(86, -143.6); } else if (t < 21) { FT.setStance('stand'); FT.walkTo(t < 19.5 ? 96 : 78, -143.6, true); } else { FT.setStance('crouch'); FT.walkTo(86, -143.6); } };
    for (let k = 0; k < 40 * 60; k++) {
      FT.tick(ctl);
      const sec = k / 60;
      if ([2, 5, 8, 13, 17, 20, 23, 28, 34, 39].some(x => Math.abs(sec - x) < 1 / 120)) snaps.push({ t: +sec.toFixed(0), see: AI.list.filter(e => e.seeing).length, st: AI.list.filter(e => e.alive).map(e => e.state[0] + (e.lkp ? Math.round(Math.hypot(e.lkp.x - P.pos.x, e.lkp.z - P.pos.z)) : '-') + '/' + Math.round(Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z))).join(' ') });
    }
    const L = FT.log();
    return { seed: s, snaps, gren: IV.weapons.throws.filter(g => g.enemy).length, fireAfterHide: L.fire.filter(f => f.t > 4).length, atPafterHide: L.fire.filter(f => f.t > 4 && f.at).length, supAfterHide: L.fire.filter(f => f.t > 4 && f.sup).length };
  }, s));
  for (const r of rows) console.log('HIDE', JSON.stringify(r));
}
if (secs.includes('cost2')) {
  for (const calm of [false, true]) for (let rep = 0; rep < 3; rep++) {
    const r = await R(([calm, rep]) => {
      const IV = __IV__.IV, AI = IV.ai;
      FT.layout(['ewall', 'side', 'hedge']);
      const en = []; for (let i = 0; i < 12; i++) en.push({ x: 50 + (i % 6) * 7, z: -165 - Math.floor(i / 6) * 10, kind: 'rifleman', smg: i % 3 === 0, combat: !calm, route: calm ? [[50 + (i % 6) * 7, -165 - Math.floor(i / 6) * 10, 2], [50 + (i % 6) * 7, -185, 2]] : undefined });
      FT.begin(30 + rep, { px: calm ? 140 : 70, pz: calm ? -100 : -150, hp: 1e6, enemies: en });
      const os = AI.step; let ms = 0;
      AI.step = function (dt) { const t = performance.now(); os(dt); ms += performance.now() - t; };
      FT.run(1); ms = 0; FT.run(20);
      AI.step = os;
      return { calm, aiStepMsPerStep: +(ms / 1200).toFixed(4), shotsAtP: FT.log().fire.length };
    }, [calm, rep]);
    console.log('COST2', JSON.stringify(r));
  }
}
async function fight(name, fn) { const rows = []; for (let s = 1; s <= NS; s++) rows.push(await R(fn, s)); for (const r of rows) console.log(name, JSON.stringify(r)); }
if (secs.includes('f1')) await fight('F1', s => {
  FT.layout(['ewall', 'side']);
  FT.begin(100 + s, { px: 70, pz: -148, weapon: 'smg', enemies: FT.squad(true) });
  const g = FT.gunner({ acq: 0.5, burst: 4 }); FT.run(45, g, () => !__IV__.IV.player.alive || FT.enemies.every(e => !e.alive)); FT.stop();
  return FT.summary();
});
if (secs.includes('f2')) await fight('F2', s => {
  const P = __IV__.IV.player;
  FT.layout(['ewall']);
  FT.begin(200 + s, { px: 38, pz: -148, weapon: 'smg', enemies: FT.squad(true) });
  let done = false; FT.run(16, () => { done = FT.walkTo(104, -148, true); }, () => done || !P.alive); FT.stop();
  return Object.assign(FT.summary(), { crossed: done });
});
if (secs.includes('f3')) await fight('F3', s => {
  const IV = __IV__.IV, P = IV.player, WP = IV.weapons, H = __IV__;
  FT.layout(['pwall', 'ewall', 'side']);
  FT.begin(300 + s, { px: 70, pz: -141.6, weapon: 'smg', stance: 'crouch', enemies: FT.squad(true) });
  const g = FT.gunner({ acq: 0.45, burst: 4, burstGap: 0.3 });
  let mode = 'hide', t = 0, want = 70;
  const ctl = () => {
    t -= 1 / 60;
    const gr = WP.throws.find(q => q.enemy && Math.hypot(q.x - P.pos.x, q.z - P.pos.z) < 7);
    if (gr) { want = gr.x > 70 ? 66.5 : 73.5; mode = 'hide'; t = 2.5; }
    if (Math.abs(P.pos.x - want) > 0.5) { FT.setStance('crouch'); H.press('fire', false); H.press('aim', false); P.yaw = want > P.pos.x ? -Math.PI / 2 : Math.PI / 2; FT.move('forward'); return; }
    FT.move(null);
    if (mode === 'hide') { FT.setStance('crouch'); H.press('fire', false); H.press('aim', false); if (t <= 0 && P.hp > 55) { mode = 'peek'; t = 1.3 + Math.random() * 0.6; if (Math.random() < 0.3) want = 66.5 + Math.random() * 7; } }
    else { FT.setStance('stand'); g(); if (t <= 0 || P.hp < 45) { mode = 'hide'; t = 1.6 + Math.random() * 1.2; } }
  };
  FT.run(150, ctl, () => !P.alive || FT.enemies.every(e => !e.alive)); FT.stop();
  return Object.assign(FT.summary(), { won: FT.enemies.every(e => !e.alive) && P.alive });
});
if (secs.includes('f4')) await fight('F4', s => {
  const IV = __IV__.IV, P = IV.player;
  FT.layout(['pwall', 'ewall', 'side', 'hedge']);
  FT.begin(400 + s, { px: 70, pz: -141.6, weapon: 'smg', stance: 'crouch', enemies: FT.squad(false) });
  for (const e of FT.enemies) { e.aw = 1; e.lkp = { x: 70, z: -141.6, t: IV.time }; e.setState('combat'); }
  const route = [[74.8, -143.4], [100, -143.6], [103.6, -146], [103.6, -171.5]];
  let i = 0, seenT = 0, seenAny = false, reached = false;
  FT.run(70, () => { FT.setStance('crouch'); if (FT.walkTo(route[i][0], route[i][1])) i++; if (i >= route.length) reached = true; if (FT.anySee()) { if (!seenAny) { const w = FT.enemies.find(e => e.alive && e.seeing); window.__F4seen = { leg: i, x: +P.pos.x.toFixed(1), z: +P.pos.z.toFixed(1), by: w ? [+w.pos.x.toFixed(1), +w.pos.z.toFixed(1), w.state, w.role] : null, t: +(FT.log().frames / 60).toFixed(1) }; } seenAny = true; seenT += 1 / 60; } }, () => reached || !P.alive);
  const S = FT.summary();
  const unseen = !seenAny && !FT.log().fire.some(f => f.at);
  if (reached && P.alive) { const g = FT.gunner({ acq: 0.45, burst: 4 }); FT.setStance('stand'); FT.run(40, g, () => !P.alive || FT.enemies.every(e => !e.alive)); }
  FT.stop();
  return Object.assign(FT.summary(), { firstSeen: seenAny ? window.__F4seen : null, reached, unseen, seenSec: +seenT.toFixed(2), routeTime: S.dur, won: FT.enemies.every(e => !e.alive) && P.alive });
});
console.log(errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'no errors');
await browser.close();
