// movement response check with REAL keyboard and mouse events (pointer lock not available in tests = the unlocked
// mouse-look path). Steps the fixed simulation by hand. Usage: node move.mjs <tag>
import { open, waitState, OUT } from './lib.mjs';
import fs from 'fs';
const tag = process.argv[2] || 'x';
const { browser, page, errors } = await open({ viewport: { width: 960, height: 540 } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play');
await page.evaluate(() => { __IV__.pauseLoop(true); const IV = __IV__.IV; IV.mission.on = false; IV.player.cine = null; IV.player.frozen = false; IV.player.god = true; IV.ai.list.forEach(e => { e.noShoot = true; }); });
// an open flat spot
const spot = await page.evaluate(() => { const IV = __IV__.IV, W = IV.world; let best = null;
  for (let x = -60; x <= 60; x += 4) for (let z = -40; z <= 170; z += 4) { if (W.near(x, z, 9).length) continue; let mx = 0; const h0 = W.height(x, z); for (const [a, b] of [[8, 0], [-8, 0], [0, 8], [0, -8], [6, 6], [-6, -6]]) mx = Math.max(mx, Math.abs(W.height(x + a, z + b) - h0)); if (W.height(x, z) < W.waterLevel(x, z)) continue; if (!best || mx < best.mx) best = { x, z, mx }; }
  return best; });
console.log('spot', JSON.stringify(spot));
const R = {};
const save = () => { fs.mkdirSync(OUT + '/logs', { recursive: true }); fs.writeFileSync(OUT + '/logs/move-' + tag + '.json', JSON.stringify(R, null, 1)); };
page.on('crash', () => console.log('PAGE CRASHED'));
const ev = (f, a) => page.evaluate(f, a);
async function reset() { save(); console.log(JSON.stringify(R).slice(-300)); await ev(s => { const H = __IV__, P = H.IV.player; H.teleport(s.x, s.z, 0); P.vel.set(0, 0, 0); P.stance = 'stand'; P.stanceT = 0; P.pitch = 0; H.IV.input.clear(); H.step(20); }, spot); }
// step n and record speed / velocity in the yaw frame (fwd, right)
async function run(n) { return ev(n => { const H = __IV__, IV = H.IV, P = IV.player, out = []; for (let i = 0; i < n; i++) { H.step(1); const f = IV.fwd(P.yaw); out.push([+(P.vel.x * f.x + P.vel.z * f.z).toFixed(3), +(P.vel.x * -f.z + P.vel.z * f.x).toFixed(3), P.stance]); } return out; }, n); }
const k = page.keyboard;
const tFirst = (arr, pred) => { const i = arr.findIndex(pred); return i < 0 ? null : +((i + 1) / 60).toFixed(3); };
const sp = a => Math.hypot(a[0], a[1]);
// (1) W from rest
await reset(); await k.down('KeyW'); let a = await run(150); await k.up('KeyW');
const jog = sp(a[a.length - 1]); R.jog = +jog.toFixed(2); R.t90jog = tFirst(a, x => sp(x) >= 0.9 * jog);
// stop
a = await run(60); R.tStop = tFirst(a, x => sp(x) < 0.1);
// (a) diagonals
for (const [n, keys] of [['WD', ['KeyW', 'KeyD']], ['WA', ['KeyW', 'KeyA']], ['SD', ['KeyS', 'KeyD']], ['WDshift', ['ShiftLeft', 'KeyW', 'KeyD']], ['Wshift', ['ShiftLeft', 'KeyW']]]) {
  await reset(); for (const c of keys) await k.down(c); a = await run(150); for (const c of keys) await k.up(c);
  const l = a[a.length - 1], s = sp(l); R[n] = { speed: +s.toFixed(2), angleDeg: +(Math.atan2(l[1], l[0]) * 180 / Math.PI).toFixed(1), t90: tFirst(a, x => sp(x) >= 0.9 * s), sprinting: await ev(() => __IV__.IV.player.sprinting) };
}
// (b) A then D reversal
await reset(); await k.down('KeyA'); a = await run(120); const sA = a[a.length - 1][1];
await k.up('KeyA'); await k.down('KeyD'); a = await run(120); await k.up('KeyD');
const sD = a[a.length - 1][1];
// dead steps: steps where the rightward velocity did not increase
let dead = 0; let prev = sA; for (let i = 0; i < 40; i++) { if (a[i][1] <= prev + 1e-4) dead++; prev = a[i][1]; }
R.revAD = { from: +sA.toFixed(2), to: +sD.toFixed(2), tZero: tFirst(a, x => x[1] >= 0), t90: tFirst(a, x => x[1] >= 0.9 * sD), deadSteps: dead, first12: a.slice(0, 12).map(x => x[1]) };
// W then S
await reset(); await k.down('KeyW'); await run(120); await k.up('KeyW'); await k.down('KeyS'); a = await run(120); await k.up('KeyS');
const sS = a[a.length - 1][0]; R.revWS = { to: +sS.toFixed(2), t90: tFirst(a, x => x[0] <= 0.9 * sS) };
// sprint then reverse
await reset(); await k.down('ShiftLeft'); await k.down('KeyW'); await run(150); await k.up('KeyW'); await k.up('ShiftLeft'); await k.down('KeyS'); a = await run(120); await k.up('KeyS');
R.revSprint = { t90: tFirst(a, x => x[0] <= 0.9 * a[a.length - 1][0]) };
// (c) keys + mouse turn together: W held, mouse moves 15 px per rendered frame for 40 frames (one step each)
await reset(); await page.mouse.move(480, 270); await k.down('KeyW'); await run(90);
const yaw0 = await ev(() => __IV__.IV.player.yaw); const trace = [];
for (let i = 0; i < 40; i++) { await page.mouse.move(480 + (i + 1) * 6, 270); const r = await ev(() => { const H = __IV__, IV = H.IV, P = IV.player; H.render(); H.step(1); const va = Math.atan2(-P.vel.x, -P.vel.z); return [P.yaw, IV.wrapA(va - P.yaw), Math.hypot(P.vel.x, P.vel.z)]; }); trace.push(r); }
await k.up('KeyW');
R.mouseTurn = { yawChangeDeg: +((trace[trace.length - 1][0] - yaw0) * 180 / Math.PI).toFixed(1), maxLagDeg: +(Math.max(...trace.map(t => Math.abs(t[1]))) * 180 / Math.PI).toFixed(1), endLagDeg: +(trace[trace.length - 1][1] * 180 / Math.PI).toFixed(1), minSpeed: +Math.min(...trace.map(t => t[2])).toFixed(2) };
// W+D while mouse turning, with Ctrl crouch (default binding check)
await reset(); await k.down('ControlLeft'); await run(3); R.ctrlCrouches = await ev(() => __IV__.IV.player.stance); await k.up('ControlLeft'); await run(3);
// stance curves: eye height per frame (camera y - feet), 1 step + 1 render per frame
async function curve(code, n) { await k.down(code); const o = []; for (let i = 0; i < n; i++) { if (i === 2) await k.up(code); o.push(await ev(() => { const H = __IV__, IV = H.IV, P = IV.player; H.step(1); H.render(); return [+(IV.world.camera.position.y - P.render.y).toFixed(3), P.stance, +(P.stanceT || 0).toFixed(2)]; })); } return o; }
await reset();
const st = {};
st.crouch = await curve('KeyC', 60); st.stand = await curve('KeyC', 60); st.prone = await curve('KeyZ', 90); st.proneToCrouch = await curve('KeyZ', 90);
await curve('KeyZ', 90); st.proneSpace = await curve('Space', 90);
const t90c = (c) => { const y0 = c[0][0], y1 = c[c.length - 1][0]; return tFirst(c, x => Math.abs(x[0] - y0) >= 0.9 * Math.abs(y1 - y0)); };
R.stance = Object.fromEntries(Object.entries(st).map(([n, c]) => [n, { from: c[0][0], to: c[c.length - 1][0], t90: t90c(c), end: c[c.length - 1][1], maxStep: +Math.max(...c.slice(1).map((x, i) => Math.abs(x[0] - c[i][0]))).toFixed(3) }]));
// speed while crouched and prone, and crouch-walk during the change
await reset(); await k.down('KeyW'); await run(90); await k.down('KeyC'); a = await run(3); await k.up('KeyC'); a = a.concat(await run(90)); R.crouchWalk = { during: Math.min(...a.slice(0, 20).map(sp)).toFixed(2), speed: sp(a[a.length - 1]).toFixed(2) };
await k.down('KeyZ'); await run(3); await k.up('KeyZ'); a = await run(120); R.proneSpeed = sp(a[a.length - 1]).toFixed(2); await k.up('KeyW');
// space: jump?
await reset(); await k.down('Space'); a = await ev(() => { const H = __IV__, P = H.IV.player, y0 = P.pos.y; let m = 0; for (let i = 0; i < 60; i++) { H.step(1); m = Math.max(m, P.pos.y - y0); } return m; }); await k.up('Space'); R.spaceApex = +a.toFixed(2);
// crosshair visibility: standing, jogging, sprinting, airborne, reloading
R.reticle = {};
async function ret(name) { R.reticle[name] = await ev(() => { const H = __IV__, IV = H.IV; IV.hud.gap = -1; H.render(); return IV.hud.gap; }); }
await reset(); await ret('stand'); await k.down('KeyW'); await run(60); await ret('jog'); await k.down('ShiftLeft'); await run(60); await ret('sprint'); await k.up('ShiftLeft'); await k.up('KeyW');
await reset(); await k.down('Space'); await run(10); await ret('air'); await k.up('Space'); await run(60);
// grenade / rock: predicted end vs first bounce, for 6 pitches
R.throws = [];
for (const kind of ['rock', 'grenade']) for (const pitch of [-0.3, -0.1, 0.05, 0.2, 0.4, 0.7]) {
  await reset();
  const r = await ev(([kind, pitch]) => { const H = __IV__, IV = H.IV, P = IV.player, WP = IV.weapons; WP.inv.grenades = 5; WP.throwCool = 0; P.pitch = pitch; H.render(); H.press(kind, true); H.step(20); H.render(); H.render();
    const pts = WP.arc ? WP.arc() : null; const pend = pts ? pts.slice(-3) : null; const n0 = WP.throws.length; H.press(kind, false);
    let first = null; for (let i = 0; i < 400 && !first; i++) { H.step(1); const g = WP.throws[WP.throws.length - 1]; if (WP.throws.length > n0 && g && g.bounced > 0) first = [g.x, g.y, g.z]; if (WP.throws.length > n0 && g && !first) g._last = [g.x, g.y, g.z]; }
    return { pend, first, d: pend && first ? Math.hypot(pend[0] - first[0], pend[2] - first[2]) : null, range: pend ? Math.hypot(pend[0] - P.pos.x, pend[2] - P.pos.z) : null }; }, [kind, pitch]);
  R.throws.push({ kind, pitch, err: r.d == null ? null : +r.d.toFixed(2), range: r.range == null ? null : +r.range.toFixed(1) });
}
R.errors = errors.concat(await ev(() => window.__errors.map(e => e.msg.slice(0, 200))));
fs.mkdirSync(OUT + '/logs', { recursive: true });
fs.writeFileSync(OUT + '/logs/move-' + tag + '.json', JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
await browser.close();
