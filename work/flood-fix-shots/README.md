# Flood Crew: first-minute screenshots (work files, not part of the site)

Before and after pictures for the flood-fix branch, so the owner can look before anything is merged.
This branch is never meant to be merged.

- `before/`: the game as merged in PR 323, played as a brand-new player (clean save), one picture every 10 seconds.
  "knows the way" runs put the player in front of the job board and van; "unguided" runs only walk and press E.
- `first-minute/`: the first 60 seconds, before and after, desktop (1280 x 800) and phone sideways (844 x 390).
  The two `...-before-top-after-bottom-0-to-60s.jpg` strips are the quickest thing to look at; the single frames
  beside them are full size. "Before" is the merged game with the player put in front of the job board and van
  (left to itself the scripted player never left the depot); "after" is the flood-fix branch with nothing but
  real keys and taps (where it looks is set by the script, because the test browser cannot move a mouse).
- `after/`: the rest of the after run (70 to 120 s), the hand-over to the depot, the job board, the second job,
  the cellar, Mill Lane on a phone, and the phone layouts upright and sideways.

All of it comes from a test browser whose graphics card is emulated in software. Shapes, colours and layout are
right; speed is not (the desktop run only got through 59 game-seconds in its two minutes), and phone pictures are
at 1x, so they are blockier than a real phone.
