**Midnight Ops preview: move to the site's newest three.js build (r187), same look** (still a private preview reached only from the admin page; needs the `no-news` label, players can't see it)

- Midnight Ops now loads `/lib/three/r187/` (the copy of three.js 0.187 already in the repo, which Ironwing uses) instead of three.js r128 from cdnjs. Nothing is meant to look or play differently; this is the groundwork for the graphics rewrite that follows.
- Every place the game edits one of three's built-in shaders now goes through one helper, `IVEnv.patch(...)` in `env/core.js`, which prints a console error naming the place if the text it looks for is not in the shader. Before, a renamed shader piece made the edit silently do nothing.
- Fixed while moving, all caused by r187 behaving differently: grass blades failed to compile; rooms were lit twice as brightly by the sky; the player's own legs collapsed to a dotted line in first person; puddles covered the whole lane on High; distant hedges thinned out; far ground and walls were slightly lighter.
- `assets/lib/GLTFLoader.js` and `SkeletonUtils.js` are deleted (4,129 lines): the r187 add-ons file provides both. `meshopt_decoder.js` stays, and Ironwing still loads it from there.

**Risky or worth knowing**
- Only `e63334287a3deaa3/ironveil/`, the Midnight Ops paragraph of `README.md` and `lib/three/README.md` change.
- Three files are shared with Ironwing. `env/post.js` and `env/texgen.js` are untouched. `env/core.js` gained the helper and changes inside material functions Ironwing never calls. Ironwing was booted to its first mission on Medium and High on this branch with no errors, and its picture is the same (difference 1.6 out of 255, which is image-compression noise).
- Draw calls are 0 to 12 higher per view and compiled shader programs 11 to 40 higher (r187 builds more shader variants). Triangles are equal or up to 8 % lower. Speed on a real graphics chip was not measured (the test machine has none).
- Ground and puddle views are about 0.5 to 1.5 out of 255 darker on average. I could not see it side by side.
- Already stale on main, not changed here: the Ironwing paragraph of `README.md` and `ironwing/CREDITS.md` still say Ironwing uses three.js r128 and loads `GLTFLoader.js` from Midnight Ops' folder. It has used the r187 add-ons for a while, so nothing breaks.
- The fallback terrain and foliage shaders (used only when the environment kit is switched off) were ported but never drawn in a test.

**Tested** (Chrome via Playwright, software rendering, only this site, cdnjs and Google Fonts reachable)
- Both missions load on Low, Medium and High with every material compiled: no page errors, no shader errors, no "patch not found" errors.
- 19 fixed-camera stills per quality, before (r128) and after (r187), simulation paused: world views differ by 0.8 to 4.4 out of 255, the same as two r128 runs differ from each other. I looked at the lane, ground, hut interior and wide night pairs side by side and could not tell them apart.
- Movement numbers: 594 of 594 identical to before (measured before the handling pull request was merged in; not rerun after). Sights within 0.4 px of centre, aim time 0.18 s. Tracers start at the drawn muzzle (0 px at FOV 60 and 74; the FOV 95 run timed out on the test machine, as it did before the move).
- HUD and touch layout clean at 1366x768, 844x390 and 390x844.
- A bot finishes Boot Camp through the real controls (all 13 objectives). A stealth bot finishes Night Drop with no deaths and without being spotted early.
- Not tested: a real graphics chip, a real phone, touch controls in play.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DfCR7RPoK1UNAvb7iRuPWn
