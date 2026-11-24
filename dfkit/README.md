# Driftfall test kit (not part of the site; never open a pull request from this branch)

Playwright scripts used to check Driftfall (`e63334287a3deaa3/drop-zone/`) in headless Chrome with software
rendering. `lib.js` allows only localhost, cdnjs and Google Fonts, so nothing reaches the live database, and gets
the page into an offline practice match with fixed clocks. Serve the repo root first:

    python3 -m http.server 8480 --directory /path/to/checkout & SRV=$!
    node cap10.js 8480 out/before hi,lo,phone     # ten fixed moments on Pretty, the lower setting and phone sizes
    node play.js 8480 out/play desk               # a practice match through real input; also 844 and 390 (touch)
    node cap.js 8480 out/cap <group>              # the older fixed-state captures (read the top of the file)
    python3 -I sheet.py out/before out/after sheet.jpg m01_drop m02_land ...   # before | after sheet
    kill $SRV

Run ONE browser job at a time: software rendering is slow and two at once make both time out. The page exposes a
test hook `__dz` (read state, teleport, put a bot in front of you, run time on). Write new capture scripts in the
same style as cap10.js (for example close-ups of characters and the Locker).
