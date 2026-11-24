// probe: boot, list places, start practice, time frames. node probe.js port outdir
const { launch, open, info, canvasShot } = require('./lib');
const fs = require('fs');
const [port, OUT] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await launch();
  const p = await open(b, { port });
  let t = Date.now(); await p.evaluate(() => __tick(5)); console.log('5 menu frames', Date.now() - t, 'ms');
  await p.screenshot({ path: OUT + '/menu.png' });
  console.log('info', JSON.stringify(await info(p)));
  console.log('places', JSON.stringify(await p.evaluate(() => __dz.places.map(q => [q.name || q.n, Math.round(q.x), Math.round(q.z)]))));
  console.log('state', await p.evaluate(() => __dz.state), 'mapSize', await p.evaluate(() => __dz.mapSize));
  t = Date.now(); await p.evaluate(() => __dz.startPractice());
  for (let i = 0; i < 40; i++) { await p.evaluate(() => __tick(1)); if (await p.evaluate(() => __dz.bots.size === 11)) break; }
  console.log('practice start', Date.now() - t, 'ms; bots', await p.evaluate(() => __dz.bots.size), 'st', await p.evaluate(() => __dz.player.st), 'matchT', await p.evaluate(() => __dz.matchT()));
  t = Date.now(); await p.evaluate(() => __tick(30)); console.log('30 bus frames', Date.now() - t, 'ms');
  await p.screenshot({ path: OUT + '/bus.png' });
  console.log('info', JSON.stringify(await info(p)), 'matchT', await p.evaluate(() => __dz.matchT()));
  console.log('errs', p.errs.length, 'warns', p.warns.length);
  await b.close();
})();
