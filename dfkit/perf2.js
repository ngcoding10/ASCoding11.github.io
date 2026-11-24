// A/B render timing in one run: node perf.js portA portB  -> boots A, B, A, B one at a time; same views, tiers 1, 2 and 0
const { launch, open, info } = require('./lib');
const [PA, PB] = process.argv.slice(2);
const VIEWS = {
  town: () => { const D = __dz, q = D.places.find(q => /Pinecone/.test(q.name || q.n)) || D.places[2]; const x = q.x, z = q.z, ang = 3.4, dist = 30, cx = x + Math.sin(ang) * dist, cz = z + Math.cos(ang) * dist; return [[cx, D.groundAt(cx, cz, 200) + 2.2, cz], [x, D.groundAt(x, z, 200) + 1.5, z]]; },
  yard: () => { const D = __dz; return [[118, D.groundAt(118, 151, 200) + 2.5, 156], [118, D.groundAt(118, 140, 200) + 1.5, 138]]; },
  island: () => [[-60, 140, 300], [120, 0, 120]],
  drop: () => [[120, 70, 300], [120, 30, 120]],
  shore: () => { const D = __dz, M = D.mapSize, a = 2.5, dx = Math.sin(a), dz = Math.cos(a); for (let r = 20; r < 200; r += .5) { const x = M / 2 + dx * r, z = M / 2 + dz * r; if (D.terrainH(x, z) < .6) return [[x - dx * 2, 1.8, z - dz * 2], [x - dx * 2 + 30 * Math.cos(2.5), .3, z - dz * 2 - 30 * Math.sin(2.5)]]; } },
};
(async () => {
  const b = await launch(); const R = {};
  for (const T of (process.env.TIERS||'1,0').split(',').map(Number)) for (const [lab, port] of [['A', PA], ['B', PB], ['A2', PA], ['B2', PB]]) {
    const ph = !!process.env.PHONE; const p = await open(b, { port, name: lab, log: () => {}, w: ph ? 844 : 1366, h: ph ? 390 : 768, touch: ph, ls: T === 0 && !ph ? { 'driftfall:gfx': 'fast' } : {} });
    await p.evaluate(() => { __dz.startPractice(); window.__noRender = true; let i = 0; while (!(__dz.bots.size === 11 && __dz.matchT() > 3) && i++ < 2000) __tick(1, 50); window.__noRender = false;
      for (const e of __dz.bots.values()) { e.present = false; e.model.visible = false; e.pos.set(5, -50, 5); } __dz.player.model.visible = false; });
    for (const t of [T]) for (const [vn, vf] of Object.entries(VIEWS).filter(([k]) => !process.env.VV || process.env.VV.split(",").includes(k))) {
      const r = await p.evaluate(([t, src]) => { const D = __dz; D.fxTier = t; const v = (0, eval)('(' + src + ')')(); const c = D.camera; c.fov = 60; c.position.set(...v[0]); c.lookAt(...v[1]); c.updateProjectionMatrix();
        window.__camLock = true; const gl = D.renderer.getContext(), px = new Uint8Array(4); for (let i = 0; i < 3; i++) { D.renderOnce(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
        const ts = []; for (let i = 0; i < 7; i++) { c.position.set(...v[0]); c.lookAt(...v[1]); const a = __realNow(); D.renderOnce(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(__realNow() - a); }
        ts.sort((a, b) => a - b); const R = D.renderer; R.info.autoReset = false; R.info.reset(); D.renderOnce(); const i = R.info; R.info.autoReset = true;
        return { ms: +ts[0].toFixed(0), med: +ts[3].toFixed(0), calls: i.render.calls, tris: i.render.triangles, prog: i.programs.length, tex: i.memory.textures, tier: D.lookKey }; }, [t, vf.toString()]);
      (R[`${vn}_t${t}`] = R[`${vn}_t${t}`] || {})[lab] = r;
      console.log(lab, `${vn}_t${t}`, JSON.stringify(r));
    }
    console.log(lab, 'errors', p.errs.length, JSON.stringify(p.errs.slice(0, 3)));
    await p.context().close();
  }
  console.log('\nview        A ms   B ms   A2 ms  B2 ms | calls A/B | tris A/B | prog A/B | tex A/B');
  for (const k of Object.keys(R)) { const r = R[k]; console.log(k.padEnd(11), ['A', 'B', 'A2', 'B2'].map(l => String(r[l] ? r[l].ms : '-').padStart(6)).join(' '), '|', r.A.calls + '/' + r.B.calls, '|', r.A.tris + '/' + r.B.tris, '|', r.A.prog + '/' + r.B.prog, '|', r.A.tex + '/' + r.B.tex); }
  await b.close();
})();
