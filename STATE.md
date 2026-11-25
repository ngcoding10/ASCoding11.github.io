# Work state, 25 Nov 2026 about 17:10 UTC

The long coordinator chat is closed. Every unfinished job now runs in its own chat (cloud session). Each one ends
with a final message for the owner containing its pull request link and the description to paste. Repository:
fork `ngcoding10/ASCoding11.github.io` -> pull requests to `ASCoding11/ASCoding11.github.io` (Arjun merges).

## Merged by Arjun so far (23-25 Nov)
Ironwing look, Midnight Ops handling, Boostball and Shell Crackers engine moves and graphics, Overdrop, Chromeline,
Pulsebox, Blackwade, Sky Duel fix, game badges, queue notice, Driftfall engine move, Midnight Ops engine move (r187).

## Jobs running in their own chats (started 25 Nov 17:06 UTC)
| Chat title | Branch | Session |
|---|---|---|
| Midnight Ops 1/3: guns + enemies | `war-play` | session_01Cw2rM8wxKCmGapChheUcgU |
| Midnight Ops 2/3: hands and guns | `war-vm` | session_01Cw2rMAfc7w9MzVfsQa3G1t |
| Midnight Ops 3/3: lighting and dirty, rough look | `war-render` | session_01Cw2rM93u11Jxws3xZJdCv5 |
| Driftfall 1/2: graphics pass | `driftfall-gfx` | session_01Cw2rMB8twdofCcPSsoTQBx |
| Driftfall: character bodies and skins (2/2) | `driftfall-chars` (pictures: `driftfall-chars-evidence`) | session_01Cw2rM7N7aV72WnTFQ3rYCi |
| Blackwade: the monster hunts in every hall | `blackwade-hunt` | session_01Cw2rM7Dg5A4egjMBVeYAdn |

Merge order: Midnight Ops 1/3, then 2/3, then 3/3 (all need the `no-news` label; they share one README paragraph, so
after one merges the next may show a README conflict: merge main into it, keep both sides' sentences). Driftfall
graphics before Driftfall characters. Blackwade and Driftfall carry What's new entries: after one merges, the other
needs main merged in with both entries kept.

## Other branches on the fork
- `mo-testkit`, `df-testkit`: test scripts for Midnight Ops and Driftfall. `work-notes`: this file. Never open pull
  requests from these three.
- `war-skill`, `war-foes`, `war-guns`: already inside `war-play` / `war-vm`; nothing to open.
