// item 9: (a) ?q=2 overrides quality for the session and is not saved; (b) software renderer -> Low with no saved
// quality; (c) ?bench flies Boot Camp for 30 s and fills window.__bench (if requestAnimationFrame runs here)
import fs from 'fs';
import { open, waitState, OUT } from './lib.mjs';
{ // (a) ?q=2 with a saved Medium; then a Settings-style persist must keep Medium in the save
  const { browser, page, errors } = await open({ viewport: { width: 800, height: 450 }, query: '?test&q=2', storage: { 'ironveil:save': JSON.stringify({ v: 1, diff: 0, missions: {}, settings: { quality: 1 }, cp: null, tut: true }) } });
  await waitState(page, 'menu', 900000);
  const r = await page.evaluate(() => { const IV = __IV__.IV; IV.save.diff = 1; IV.persist(); return { worldQuality: IV.world.quality, why: IV.qualityWhy, savedQualityAfterPersist: JSON.parse(localStorage.getItem('ironveil:save')).settings.quality }; });
  console.log('(a) ?q=2 over saved Medium:', JSON.stringify(r), errors.filter(e => !/ERR_FAILED|404/.test(e)).length ? errors : '');
  await browser.close();
}
{ // (b)+(c) no saved quality, this software renderer, ?bench
  const { browser, page, errors } = await open({ viewport: { width: 960, height: 540 }, query: '?bench' });
  await page.addInitScript(() => { try { localStorage.removeItem('ironveil:save'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  const ok = await page.waitForFunction(() => window.__bench, null, { timeout: 420000 }).then(() => true).catch(() => false);
  const st = await page.evaluate(() => ({ bench: window.__bench || null, frames: window.__frames, quality: window.IV && IV.world.quality, why: window.IV && IV.qualityWhy, gpu: window.IV && IV.gpuName, audio: window.IV && { disabled: IV.audio.disabled, ctx: !!IV.audio.ctx }, errors: window.__errors }));
  console.log('(b)(c) bench finished:', ok, 'after', ((Date.now() - t0) / 1000).toFixed(0), 's', JSON.stringify(st));
  await page.screenshot({ path: OUT + '/stills/bench-bootcamp.jpg', type: 'jpeg', quality: 85, timeout: 90000 }).catch(e => console.log('snap failed', e.message));
  console.log('errors:', errors.filter(e => !/ERR_FAILED|404/.test(e)).join('\n') || 'none');
  await browser.close();
}
