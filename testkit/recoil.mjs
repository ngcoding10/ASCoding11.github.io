// recoil curves: rifle/pistol single shot (view pitch vs time) and five 30-round SMG strings (climb at the end)
import { open, waitState } from './lib.mjs';
const { browser, page, errors } = await open({ viewport: { width: 800, height: 450 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: { bootcamp: { done: true } }, settings: { quality: 0 }, cp: null, tut: true }) } });
await waitState(page, 'menu', 900000);
await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
const r = await page.evaluate(() => {
  __IV__.pauseLoop(true); const IV = __IV__.IV, P = IV.player, C = IV.camera, WP = IV.weapons;
  IV.mission.on = false; P.cine = null; P.frozen = false; IV.mission.noWeapons = false; IV.ai.ignorePlayer = true;
  __IV__.teleport(0, 120, 0);
  const fr = () => { __IV__.step(1); IV.player.frame(1, 1 / 60); IV.camera.frame(1 / 60); };
  const view = () => P.pitch + (C.recP || 0);
  const out = {};
  for (const w of ['rifle', 'pistol']) {
    WP.has[w] = true; WP.equip(w); for (let i = 0; i < 80; i++) fr();
    WP.inv[w].mag = 5; P.pitch = 0; for (let i = 0; i < 30; i++) fr();
    const p0 = view(); __IV__.press('fire', true); fr(); __IV__.press('fire', false);
    const curve = []; let peak = 0, peakT = 0;
    for (let i = 1; i <= 42; i++) { fr(); const d = view() - p0; curve.push(+(d * 1000).toFixed(1)); if (d > peak) { peak = d; peakT = i / 60; } }
    out[w] = { peak_mrad: +(peak * 1000).toFixed(1), peak_ms: Math.round(peakT * 1000), at100ms: curve[5], at200ms: curve[11], at500ms: curve[29], at700ms: curve[41], kept_mrad: +((P.pitch - p0) * 1000).toFixed(1), curve_mrad_per_frame: curve.slice(0, 36).join(' ') };
  }
  WP.equip('smg'); for (let i = 0; i < 60; i++) fr();
  const climbs = [], yaws = [];
  for (let run = 0; run < 5; run++) {
    WP.inv.smg.mag = 30; WP.inv.smg.res = 120; P.pitch = 0; P.yaw = 0; for (let i = 0; i < 40; i++) fr();
    const p0 = view(), y0 = P.yaw + (C.recY || 0); __IV__.press('fire', true);
    let n = 0; while (WP.inv.smg.mag > 0 && n < 400) { fr(); n++; }
    __IV__.press('fire', false);
    climbs.push(+((view() - p0) * 1000).toFixed(1)); yaws.push(+((P.yaw + (C.recY || 0) - y0) * 1000).toFixed(1));
    for (let i = 0; i < 60; i++) fr();
  }
  const mean = climbs.reduce((a, b) => a + b) / climbs.length, dev = Math.max(...climbs.map(c => Math.abs(c - mean))) / mean;
  out.smg = { climb_mrad_at_last_round: climbs, yaw_mrad: yaws, maxDevFromMean: +(dev * 100).toFixed(1) + '%' };
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
await browser.close();
