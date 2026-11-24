# Work state, saved 24 Nov 2026 about 01:15 UTC (all helpers paused to save usage)

Everything below is pushed to the fork. Nothing is running. To carry on, tell the coordinator session "continue".

## Ready to open as pull requests (merge cleanly into Arjun's main at f5df066)
- `shellcrackers-gfx` (700f86c): Shell Crackers graphics, What's new 1.50. Description: shellcrackers-gfx-pr-body.md here.
- `war-r187` (5776288): Midnight Ops engine move to three.js r187, same look. Needs the `no-news` label. Description: r187-pr-body.md here.

## Midnight Ops, in progress (all admin-only preview, `no-news`; each builds on `war-r187`)
- `war-play` (0f1be4f) = war-r187 + `war-skill` (player's guns) + `war-foes` (enemies) + a muzzle guard + README.
  Checked here: loads on Low/Medium/High, layout, aim, Ironwing boot; Night Drop bot finishes, unspotted in the
  stealth part, 1 death running to extraction. NOT finished: the repeat bot runs on the cloud machine (3x Night Drop,
  2x Boot Camp) were interrupted. Next: rerun those, write the pull request description, send the link.
- `war-vm` (a23ee08) = hands rebuild round 4 + new gun models (`war-guns` merged in). Helper was stopped while
  re-taking its final pictures; its last note: aim check done, sights within 0.3 px. Nobody has looked at round 4's
  pictures yet. Next: resume the helper (or rerun its captures), judge against the reference sheet.
- `war-render` (474f171) = lighting and render rewrite, round 2 (dirt and wear, readable night, shade fill). Helper
  was stopped while building its final comparison sheet. Next: resume, judge the 19 pairs + dirt close-ups + the
  dark-field guard views.
- Order to send: war-r187, then war-play, then war-vm, then war-render.

## Driftfall, in progress
- `driftfall-gfx` (7606bdf) = graphics pass round 2 (new sky and clearer island on every setting, one cloud style,
  effects). Helper stopped while re-taking final pictures and play tests. Its What's new entry still says version
  'X.XX' (next free is 1.51). Next: resume, look at both sheets, set the version, merge main, send.
- `driftfall-chars` = character bodies and skins. Cloud helper was interrupted minutes after starting; no work yet
  (branch equals driftfall-gfx). Its full brief is in its session. Next: resume it.

## Asked for, not started
- Blackwade (folder `hush-pools`): the owner waded through the water after the first hall and nothing attacked him;
  he wants it harder, with the monster there in every hall ("a scary monster per room but the same guy").
  What I found reading the code and README: there is one monster that follows the party; when the party enters
  a new hall it sinks and rises somewhere FAR from everyone, and it only hears a noise within 20 m x loudness
  (wading is 0.45, so about 9 m; a full splash 20 m) in halls 56 m wide and up to 70 m long. So after the first hall
  it can sit out of earshot for the whole crossing. Fix to build: on entering each hall the monster shows itself
  (rise with a shriek in view, not far away), going into the water is heard across the whole hall, wading keeps
  pulling it closer, and each later hall makes it a little faster and sharper; keep one monster design, the network
  format, saved data and Easy mode's forgiveness. Needs its own tests (the game's core rules are pure functions).

## Helper sessions (resume by message; they keep their context)
- Local agents in the coordinator session: hands ae8d2a5a1f8fd6c84, lighting a9f22f5275356235c, Driftfall graphics
  ada5ffca5df864422.
- Cloud sessions: war-skill session_01Cw2rM7Bycwoc6n2GG95HK7 (was running the war-play repeat tests), war-foes
  session_01Cw2rMA1ShmNuiCqMrmnvkS (done), war-guns session_01Cw2rM9iMnuTDJvCZtHozJQ (done), driftfall-chars
  session_01Cw2rM7N7aV72WnTFQ3rYCi (interrupted at the start).
- Test kits on the fork: branches `mo-testkit` (Midnight Ops) and `df-testkit` (Driftfall). Never open pull requests
  from them, or from this notes branch.
- The two-hourly check-in is switched off (scheduled task "Game work check-in"); switch it back on when work resumes.
