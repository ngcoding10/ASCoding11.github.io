#!/bin/bash
# Serve a SNAPSHOT of a checkout (Midnight Ops + Ironwing + lib/three + the shared Back Room scripts) on localhost,
# run one test script from this folder against it, stop the server, delete the snapshot.
#   WT=/path/to/checkout [PORT=8962] [TMO=2400] [OUT=/path/for/stills] bash run.sh smokeq.mjs 1
# Run ONE browser job at a time (software rendering is slow; two at once make both time out).
SRC=${WT:?set WT to the repo checkout}
HERE=$(cd "$(dirname "$0")" && pwd)
SN=$(mktemp -d); mkdir -p $SN/e63334287a3deaa3
cp -r $SRC/e63334287a3deaa3/ironveil $SRC/e63334287a3deaa3/ironwing $SN/e63334287a3deaa3/
for x in lang.js autores.js keybinds.js stats.js; do [ -f $SRC/e63334287a3deaa3/$x ] && cp $SRC/e63334287a3deaa3/$x $SN/e63334287a3deaa3/; done
[ -f $SN/e63334287a3deaa3/keybinds.js ] || { echo "not a checkout: $SRC"; rm -rf $SN; exit 1; }
mkdir -p $SN/lib && cp -r $SRC/lib/three $SN/lib/ 2>/dev/null
P=${PORT:-8962}
if curl -s -o /dev/null http://localhost:$P/; then echo "port $P busy"; rm -rf $SN; exit 3; fi
python3 -m http.server $P --directory $SN >/dev/null 2>&1 & SRV=$!
for i in $(seq 1 50); do curl -s -o /dev/null http://localhost:$P/ && break; sleep 0.2; done
cd $HERE
env PORT=$P timeout ${TMO:-2400} node "$@"; rc=$?
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
rm -rf $SN
exit $rc
