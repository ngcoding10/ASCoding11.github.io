# Midnight Ops test kit (not part of the site; never open a pull request from this branch)

Playwright scripts used to check Midnight Ops (`e63334287a3deaa3/ironveil/`) in headless Chrome with software
rendering. They block every host except localhost, cdnjs and Google Fonts, so nothing reaches the live database.

    WT=/path/to/checkout bash run.sh smokeq.mjs 1        # both missions load on Medium; 0 = Low, 2 = High
    WT=... bash run.sh bootcamp.mjs                       # a bot plays Boot Camp through the real controls
    WT=... bash run.sh nd-run.mjs stealth                 # a stealth bot plays Night Drop
    WT=... bash run.sh hudcheck.mjs                       # HUD and touch layout at 1366x768, 844x390, 390x844
    WT=... bash run.sh recoil.mjs <label>                 # recoil path per weapon
    WT=... bash run.sh move.mjs <label>                   # movement speeds and response times
    WT=... bash run.sh aimcheck.mjs <label>               # aim time, sights on centre
    WT=... bash run.sh audio.mjs                          # offline audio self-test
    WT=... bash run.sh iw.mjs 1                           # Ironwing boots (it shares three env files)

`lib.mjs`: `open()` starts the page with the preview gate opened in the served copy only (the shipped file is not
touched), `waitState()`, `snap()`. The page exposes `window.__IV__` test hooks when loaded with `?test`. Stills and
logs go to `$OUT` (default `./out`). One browser job at a time; a boot takes 1 to 3 minutes on a 4-core machine.

Scripted fights (written by the enemies helper): `WT=... bash run.sh ft-measure.mjs <difficulty 0|1|2>
detect,acc,hide,cost2,f1,f2,f3,f4 <runs>` builds a small arena on open ground in Night Drop and measures time to
first shot, hit chance by range and stance, what the squad knows after you hide, AI cost, and four fights (stand in
the open, sprint across, cover and bursts, flank in the dark). `python3 tables.py <output file>` prints tables.
