// audio: (1) at the title, no AudioContext exists yet (no gesture) and the bank has rendered in slices: timings;
// (2) the offline 10 s firefight self-test (numbers + a WAV); (3) with Web Audio removed the game boots, plays and
// shoots with no errors and stays silent
import fs from 'fs';
import { open, waitState, OUT } from './lib.mjs';
{
  const { browser, page, errors } = await open({ viewport: { width: 800, height: 450 } });
  await waitState(page, 'menu', 900000);
  await page.waitForFunction(() => __IV__.IV.audio.bankReady(), null, { timeout: 120000 }).catch(() => {});
  const a = await page.evaluate(() => ({ ctxBeforeGesture: __IV__.IV.audio.ctx, bank: __IV__.IV.audio.bankStats }));
  console.log('title:', JSON.stringify(a));
  const r = await page.evaluate(async () => { const r = await __IV__.IV.audio.selfTest(); const b = __IV__.IV.audio.lastSelfTest; const n = b.length, L = b.getChannelData(0), R = b.getChannelData(1), dv = new DataView(new ArrayBuffer(44 + n * 4)); const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }; w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, b.sampleRate, true); dv.setUint32(28, b.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true); for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); } let s = ''; const u = new Uint8Array(dv.buffer); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); r.wav = btoa(s); return r; });
  fs.writeFileSync(OUT + '/selftest-firefight.wav', Buffer.from(r.wav, 'base64')); delete r.wav;
  console.log('selftest:', JSON.stringify(r));
  console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
  await browser.close();
}
{
  const { browser, page, errors } = await open({ viewport: { width: 800, height: 450 }, init: true });
  await page.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; delete window.OfflineAudioContext; window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitState(page, 'menu', 900000);
  await page.mouse.click(400, 225); await page.keyboard.press('KeyM'); await page.keyboard.press('KeyM');
  await page.evaluate(() => __IV__.start('bootcamp', 0)); await waitState(page, 'play', 600000);
  const r = await page.evaluate(() => { __IV__.pauseLoop(true); const IV = __IV__.IV; IV.mission.on = false; IV.player.cine = null; IV.player.frozen = false; IV.mission.noWeapons = false; IV.audio.init(); IV.weapons.equip('smg'); __IV__.press('fire', true); for (let i = 0; i < 60; i++) { __IV__.step(1); __IV__.render(); } __IV__.press('fire', false); IV.audio.rain(1, 1); IV.audio.play('explosion', { x: 3, z: 3 }); for (let i = 0; i < 30; i++) { __IV__.step(1); __IV__.render(); } return { hasAC: !!window.AudioContext, disabled: IV.audio.disabled, ctx: IV.audio.ctx, shots: IV.weapons.stats.shots, errs: window.__errors.length }; });
  console.log('no Web Audio:', JSON.stringify(r));
  console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
  await browser.close();
}
