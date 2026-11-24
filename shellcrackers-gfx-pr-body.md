**Shell Crackers: glowing yolk bombs, a block pattern on the ground, a better-lit gun** (What's new entry 1.50 included, English and Spanish)

- **Yolk bombs (Pretty):** a white flash, an orange fireball and a rolling cream cloud instead of a flat yellow dome. Hits kick up dust from blocks and yolk from eggs, and muzzle flashes have a soft glow. Fast keeps the old dome.
- **Ground (Pretty):** grass, sand, snow and dirt show a gentle two-tone 1 m grid that fades with distance, so the big flat areas are no longer one colour.
- **Gun (every setting):** lit more clearly with brighter top edges, in each map's light colours.
- **Shadows (Pretty):** softer edges.
- Nothing changes in how the game plays, in saved items, room codes or what is sent between players. The new effects use their own random numbers, so bots and bullet spread behave exactly as before.

**Risky or worth knowing**
- Only `e63334287a3deaa3/shell-crackers/index.html`, the Shell Crackers paragraph of `README.md`, `news.js` and `news-es.js` change.
- **This is a modest update.** It shows clearly on Farmstead, Hardboil Heights and whenever a yolk bomb goes off. On Yolk Works, Eggsburg and the Deep Freeze spawn the only visible difference is a slightly lighter gun.
- Also in the code but not visible in the test stills: darker corners where blocks meet, and haze that starts nearer. The What's new entry does not claim them.
- On concrete the softer shadow edge is slightly speckled. Shadows were not checked map by map for acne or floating.
- **Phones run Pretty in this game**, so they get the grid and effects: 2 more draw calls in play and 1 to 2 more shader programs. Render time at phone size on the test machine moved 2 %, inside the noise. Desktop Pretty measured 8 % slower with other jobs running on the machine; a real graphics chip and a real phone were not measured.
- Aim and Reload overlap on phones. They did before this change too; not fixed here.

**Tested** (Chrome via Playwright, software rendering, live database blocked)
- Stills of all six maps, capture the flag, Turkey Week, training, the locker, Fast and both phone sizes, before and after: no page or shader errors.
- A desktop match with real input: fire, reload, bomb and jump work; the match was ended by setting the clock, the end screen showed, and it returned to the menu.
- Touch at both phone sizes: all controls respond.
- The game page, the Back Room page and the phone page load with no errors after merging current main.
- Not tested: online play with two browser windows, a real graphics chip, a real phone, switching the graphics setting mid-match. **Please play one online match with two windows before merging.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01DfCR7RPoK1UNAvb7iRuPWn
