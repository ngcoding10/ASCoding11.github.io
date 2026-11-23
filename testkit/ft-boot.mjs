// shared boot for scripted fights: Night Drop at difficulty d, harness injected
import { open, waitState } from './lib.mjs';
import path from 'path';
export async function boot(diff, q = 0) {
  const o = await open({ viewport: { width: 480, height: 270 }, storage: { 'ironveil:save': JSON.stringify({ v: 1, diff, missions: { bootcamp: { done: true } }, settings: { quality: q }, cp: null, tut: true }) } });
  await waitState(o.page, 'menu', 900000);
  await o.page.evaluate(() => __IV__.start('nightdrop', 0)); await waitState(o.page, 'play', 600000);
  await o.page.evaluate(() => { __IV__.pauseLoop(true); __IV__.step(5); });
  await o.page.addScriptTag({ path: path.join(path.dirname(new URL(import.meta.url).pathname), 'ft-lib.js') });
  await o.page.evaluate(() => FT.buildArena());
  return o;
}
