// A practice match through real input, to the end screen. node play.js <port> <outdir> [desk|844|390]
// Desktop: mouse clicks and keys. Phones: touch pointer events on every on-screen button, each checked for its effect.
// The test hook (__dz) is used only to read state, to put a bot in front of you (aimAt / teleport), and to run time on.
const { launch, open } = require('./lib');
const fs = require('fs');
const [PORT, OUT, KIND = 'desk'] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (name, pass, detail) => { res.push([name, pass]); console.log(`${pass ? 'ok  ' : 'FAIL'} ${name} ${detail !== undefined ? JSON.stringify(detail) : ''}`); };
(async () => {
  const b = await launch();
  const touch = KIND !== 'desk', [w, h] = KIND === '844' ? [844, 390] : KIND === '390' ? [390, 844] : [1366, 768];
  // headless Chromium's renderer crashed when the page took the mouse (pointer lock) here, on r128 as on r187: the lock is
  // refused instead, so the game uses its own fallback (look while a mouse button is held), as when a browser says no
  const p = await open(b, { port: PORT, w, h, touch, name: KIND, log: s => console.log(s), init: () => { Element.prototype.requestPointerLock = function () { return Promise.reject(new DOMException('no pointer lock in this test', 'NotSupportedError')); }; } });
  // every frame runs the game; only the last of each batch is drawn (drawing every frame of a fast test ran the software
  // renderer's page out of memory, on r128 as on r187)
  const tick = (n, ms = 1000 / 60) => p.evaluate(([n, ms]) => { if (n > 1) { window.__noRender = true; __tick(n - 1, ms); window.__noRender = false; } __tick(1, ms); }, [n, ms]);
  const S = () => p.evaluate(() => { const D = __dz, P = D.player; return { st: P.st, state: D.state, alive: P.alive, hp: P.hp, sel: P.sel, inv: P.inv.map(s => s && s.t + ':' + s.n), mode: D.mode, pieces: D.pieces.size, kills: D.myKills, yaw: +P.yaw.toFixed(3), x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), y: +P.pos.y.toFixed(2), vy: +P.vel.y.toFixed(2), t: +D.matchT().toFixed(1), mats: P.mats, reloadT: P.reloadT, aim: !!D.tAct.aim, edit: !!D.edit }; });
  const snap = n => p.screenshot({ path: `${OUT}/${KIND}_${n}.png`, timeout: 300000 });
  // touch: a press on an element, held for n frames
  const press = async (id, n = 3, dx = 0, dy = 0) => { const r = await p.evaluate(id => { const e = document.getElementById(id); if (!e || e.hidden || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, id);
    if (!r) return false; const o = { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r[0], clientY: r[1], bubbles: true };
    await p.locator('#' + id).dispatchEvent('pointerdown', o); if (dx || dy) await p.locator('#' + id).dispatchEvent('pointermove', Object.assign({}, o, { clientX: r[0] + dx, clientY: r[1] + dy }));
    await tick(n); await p.locator('#' + id).dispatchEvent('pointerup', Object.assign({}, o, { clientX: r[0] + dx, clientY: r[1] + dy })); await tick(1); return true; };
  const click = async (n = 2) => { await p.mouse.move(w / 2, h / 2); await p.mouse.down(); await tick(n); await p.mouse.up(); await tick(1); };
  const key = async (k, n = 2) => { await p.keyboard.down(k); await tick(n); await p.keyboard.up(k); await tick(1); };

  await tick(10); await snap('menu');
  if (touch) await p.locator('#play').dispatchEvent('click'); else await p.click('#play');
  for (let i = 0; i < 300; i++) { await tick(3, 50); if (await p.evaluate(() => __dz.player.st === 'bus' && __dz.matchT() > 2)) break; }
  let s = await S(); ok('practice started from the menu button', s.st === 'bus' && s.state === 'playing', s);
  if (!touch) { await click(); await tick(2); }   // the first click asks for the mouse (falls back to drag-to-look here)
  // wait until the Drifter is over the island (you may jump from then on)
  for (let i = 0; i < 300; i++) { if (await p.evaluate(() => __dz.matchT() > __dz.busLine.tIn + .5)) break; await tick(4, 50); }
  // drop and glide
  if (touch) await press('tJump', 3); else await key('Space', 3);
  await tick(20, 50); s = await S(); ok('jumped out of the Drifter', s.st === 'fall', s.st);
  if (touch) await press('tJump', 3); else await key('Space', 3);
  await tick(10, 50); s = await S(); ok('glider opened', s.st === 'glide', s.st);
  await snap('glide');
  if (touch) { await p.evaluate(() => { const D = __dz, P = D.player; P.pos.y = Math.min(P.pos.y, D.groundAt(P.pos.x, P.pos.z, 200) + 6); }); }
  else { await p.keyboard.down('KeyW'); await tick(30, 50); await p.keyboard.up('KeyW'); await p.evaluate(() => { const D = __dz, P = D.player; P.pos.y = Math.min(P.pos.y, D.groundAt(P.pos.x, P.pos.z, 200) + 6); }); }
  for (let i = 0; i < 100; i++) { await tick(2, 50); if ((await S()).st === 'ground') break; }
  s = await S(); ok('landed', s.st === 'ground', s.st);
  // move: W held / the stick pushed up; look: drag
  const p0 = await S();
  if (touch) await press('tStick', 30, 0, -40); else { await p.keyboard.down('KeyW'); await tick(30); await p.keyboard.up('KeyW'); }
  let p1 = await S(); ok('moved', Math.hypot(p1.x - p0.x, p1.z - p0.z) > .5, [p0.x, p0.z, p1.x, p1.z]);
  if (touch) await press('tLook', 4, 60, 0); else { await p.mouse.move(w / 2, h / 2); await p.mouse.down({ button: 'right' }); await p.mouse.move(w / 2 + 120, h / 2, { steps: 4 }); await tick(2); await p.mouse.up({ button: 'right' }); }
  p1 = await S(); ok('looked round', Math.abs(p1.yaw - p0.yaw) > .05, [p0.yaw, p1.yaw]);
  // a chest: go next to the nearest one, open it, take what's in reach
  await p.evaluate(() => { const D = __dz, P = D.player; let c = null, bd = 1e9; for (const q of D.chests) { if (!q.present || q.open) continue; const d = Math.hypot(q.x - P.pos.x, q.z - P.pos.z); if (d < bd) { bd = d; c = q; } }
    window.__c = c && [c.x, c.y, c.z]; if (c) { D.teleport(c.x, c.z, c.y); P.pitch = -.3; } });
  await tick(5);
  const inv0 = (await S()).inv.filter(Boolean).length;
  if (touch) await press('tUse', 2); else await key('KeyG', 2);
  await tick(40);
  for (let k = 0; k < 4; k++) { if (touch) await press('tUse', 2); else await key('KeyG', 2); await tick(10); }
  s = await S(); ok('opened a chest and took something', s.inv.filter(Boolean).length > inv0, { chest: await p.evaluate(() => window.__c), inv: s.inv });
  await snap('chest');
  // a weapon in hand (given if the chest had none), a bot in front of you, shoot it
  await p.evaluate(() => { const D = __dz, P = D.player; if (!P.inv.some(s => s && D.WEAP[s.t])) D.give('ar', 3); });
  const slot = await p.evaluate(() => __dz.player.inv.findIndex(s => s && __dz.WEAP[s.t]));
  if (touch) await press('slot' + slot, 2); else await key('Digit' + (slot + 1), 2);
  await tick(20);
  s = await S(); ok('weapon selected with ' + (touch ? 'its slot button' : 'its number key'), s.sel === slot, [slot, s.sel]);
  const bt = await p.evaluate(() => { const D = __dz, P = D.player; D.teleport(118, 151); P.yaw = 0; const bt = [...D.bots.values()].find(b => b.alive); const f = D.fwdOf(P.yaw, 0);
    bt.pos.set(P.pos.x + f.x * 7, D.groundAt(P.pos.x + f.x * 7, P.pos.z + f.z * 7, 200), P.pos.z + f.z * 7); bt.vel.set(0, 0, 0);
    bt.st = 'ground'; bt.onGround = true; bt.float = false; bt.glide = false; bt.present = true; bt.hittable = true; bt.model.visible = true; bt.hp = 100; bt.sh = 0; window.__bt = bt; window.__freeze = setInterval(() => {}, 1e9); return bt.id; });
  let hp0 = await p.evaluate(() => __bt.hp + (__bt.sh || 0)), ammo0 = (await S()).inv[slot];
  for (let k = 0; k < 12; k++) {
    await p.evaluate(() => { const D = __dz; __bt.st = 'ground'; __bt.present = true; __bt.hittable = true; D.aimAt(__bt); __bt.vel.set(0, 0, 0); });
    if (touch) await press('tFire', 6); else await click(6);
    await tick(8);
    if (!(await p.evaluate(() => __bt.alive))) break;
  }
  const hp1 = await p.evaluate(() => [__bt.alive, __bt.hp + (__bt.sh || 0)]);
  s = await S(); ok('shot a bot (hits register)', !hp1[0] || hp1[1] < hp0, { hp0, after: hp1, ammo0, ammo: s.inv[slot], kills: s.kills });
  await snap('fight');
  // aim and reload
  if (touch) { await press('tAim', 2); s = await S(); ok('Aim button toggles aim', s.aim, s.aim); await press('tAim', 2); }
  else { await p.mouse.down({ button: 'right' }); await tick(10); s = await p.evaluate(() => __dz.isADS(__dz.player)); await p.mouse.up({ button: 'right' }); ok('right mouse aims', !!s, s); }
  await p.evaluate(() => { const D = __dz, P = D.player, it = P.inv[P.sel]; if (it) it.n = 1; });
  if (touch) await press('tReload', 2); else await key('KeyR', 2);
  await tick(2); s = await S(); ok('reload starts', s.reloadT > 0, s.reloadT);
  await tick(150);
  // build: a wall (Q / the scrap chip then the wall button), placed with a click / Fire
  await p.evaluate(() => { const P = __dz.player; P.mats = 100; P.pitch = -.1; });
  const pc0 = (await S()).pieces;
  if (touch) { await press('matsBox', 2); await tick(4); const bm = await S(); ok('scrap chip starts building (wall by default)', bm.mode === 'build', bm.mode); await press('tFire', 3); }
  else { await key('KeyQ', 2); await tick(4); await click(3); }
  await tick(30); s = await S(); ok('built a wall', s.pieces > pc0, [pc0, s.pieces, s.mode]);
  await snap('build');
  if (touch) { await press('matsBox', 2); } else await key('KeyB', 2);
  await tick(5); s = await S(); ok('left build mode', s.mode === 'combat', s.mode);
  // edit the wall just built: Edit, pick a tile, confirm
  await p.evaluate(() => { const D = __dz, P = D.player, pc = [...D.pieces.values()].pop(); if (pc) { const c = D.pieceCentre(pc.spec); const t = new THREE.Vector3(c.x, c.y, c.z); P.pitch = 0; for (let i = 0; i < 4; i++) { D.updateCamera(0); const cam = D.camera.position; P.yaw = Math.atan2(-(t.x - cam.x), -(t.z - cam.z)); P.pitch = Math.atan2(t.y - cam.y, Math.hypot(t.x - cam.x, t.z - cam.z)); } } });
  await tick(4);
  const ed0 = await p.evaluate(() => { const pc = [...__dz.pieces.values()].pop(); return pc ? pc.ed : null; });
  if (touch) { await press('tEdit', 2); await tick(4); s = await S(); const opened = s.edit; await press('tFire', 2); await tick(4); await press('tEdit', 2); ok('Edit button opens the edit grid', opened, opened); }
  else { await key('KeyH', 1); await tick(4); s = await S(); const opened = s.edit; await key('KeyH', 1); ok('H opens the edit grid (the tile under the crosshair is picked while it is down)', opened, opened); }
  await tick(20);
  const ed1 = await p.evaluate(() => { const pc = [...__dz.pieces.values()].pop(); return pc ? pc.ed : null; });
  ok('edit changed the wall', ed0 != null && ed1 !== ed0, [ed0, ed1]);
  await snap('edit');
  // crowbar and slots
  if (touch) await press('slotX', 2); else await key('KeyV', 2);
  await tick(5); s = await S(); ok('crowbar selected', s.sel === -1, s.sel);
  // the big map, pause and resume
  if (touch) { await p.locator('#mini').dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true }); } else await key('KeyM', 1);
  await tick(3); let bm = await p.evaluate(() => !document.getElementById('bigmap').hidden); ok('big map opens', bm, bm); await snap('bigmap');
  if (touch) await p.locator('#bigmap').dispatchEvent('pointerdown', { pointerType: 'touch', bubbles: true }); else await key('KeyM', 1);
  await tick(3);
  if (touch) await press('tPause', 2); else await key('KeyP', 1);
  await tick(3); let pz = await p.evaluate(() => !document.getElementById('pause').hidden); ok('pause opens', pz, pz); await snap('pause');
  await p.click('#resume', { force: true }).catch(async () => p.locator('#resume').dispatchEvent('click')); await tick(3);
  pz = await p.evaluate(() => document.getElementById('pause').hidden); ok('resumed', pz, pz);
  if (touch) { const ov = await p.evaluate(() => { const ids = ['tPause', 'vitals', 'slots', 'mapBox', 'tStick', 'tFire', 'tJump', 'tAim', 'tReload', 'feed', 'ammo', 'tUse', 'tEdit', 'hint'];
      const r = id => { const e = document.getElementById(id); if (!e || e.hidden || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
      const o = {}; for (const i of ids) o[i] = r(i); const k = Object.keys(o).filter(i => o[i]), ov = []; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = o[k[i]], c = o[k[j]]; if (!(a[2] <= c[0] || c[2] <= a[0] || a[3] <= c[1] || c[3] <= a[1])) ov.push(k[i] + '/' + k[j]); } return ov; });
    console.log('overlaps ' + JSON.stringify(ov)); }
  // the rest of the match: time runs on (drawn every 20th frame) until the end screen
  await p.evaluate(() => clearInterval(window.__freeze));
  let endT = null;
  for (let i = 0; i < 400; i++) { await p.evaluate(() => { window.__noRender = true; __tick(19, 50); window.__noRender = false; __tick(1, 50); });
    const e = await p.evaluate(() => ({ end: !document.getElementById('end').hidden, t: __dz.matchT(), alive: __dz.player.alive, n: __dz.aliveIds ? __dz.aliveIds().length : -1 }));
    if (e.end) { endT = e; break; } }
  ok('match reached its end screen', !!endT, endT);
  await snap('end');
  const endTxt = await p.evaluate(() => [document.getElementById('endTitle').textContent, document.getElementById('endMsg').textContent]);
  console.log('end text ' + JSON.stringify(endTxt));
  if (touch) await p.locator('#toMenu').dispatchEvent('click'); else await p.click('#toMenu');
  await tick(5); s = await S(); ok('back to the menu', s.state === 'menu', s.state);
  console.log(`errors ${p.errs.length} ${JSON.stringify(p.errs.slice(0, 5))}`);
  console.log(`warnings ${p.warns.length} ${JSON.stringify([...new Set(p.warns.map(x => x.slice(0, 120)))].slice(0, 8))}`);
  console.log(`RESULT ${res.filter(r => r[1]).length}/${res.length} passed`);
  await b.close();
})();
