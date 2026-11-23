import json, sys, statistics as st
def med(a): a = [x for x in a if x is not None]; return round(st.median(a), 2) if a else None
for fn in sys.argv[1:]:
    rows = {}
    for line in open(fn):
        line = line.strip()
        for k in ('DETECT', 'ACC', 'HIDE', 'COST', 'F1', 'F2', 'F3', 'F4', 'DIFF'):
            if line.startswith(k + ' '):
                rest = line[len(k) + 1:]
                if k == 'DETECT':
                    lit, js = rest.split(' ', 1); rows.setdefault(k, []).append((lit, json.loads(js)))
                elif k == 'DIFF': rows['DIFF'] = rest
                else:
                    try: rows.setdefault(k, []).append(json.loads(rest))
                    except Exception: pass
    print('\n## ' + fn + '  (difficulty ' + str(rows.get('DIFF')) + ')')
    for lit, rs in rows.get('DETECT', []):
        print(f"- detect 15 m, {lit}: first sight->first round median {med([r['sightToShot'] for r in rs])} s ({sum(1 for r in rs if r['fire'] is None)}/{len(rs)} never fired), tell->first round min {min([r['teleToShot'] for r in rs if r['teleToShot'] is not None], default=None)} s")
    for r in rows.get('ACC', []): print(f"| {r['d']} m | {r['mode']} | {r['early']} ({r['earlyN']}) | {r['late']} ({r['lateN']}) | {r['dmg']} |")
    for k in ('F1', 'F2', 'F3', 'F4'):
        rs = rows.get(k)
        if not rs: continue
        hps = [r.get('hitsPerSecUnderFire', 0) for r in rs]
        print(f"{k} ({len(rs)} runs): died {sum(1 for r in rs if r['pdied'] is not None)}, died<5s after first round {sum(1 for r in rs if r['dieAfterFire'] is not None and r['dieAfterFire'] < 5)}, won {sum(1 for r in rs if r.get('won'))}, unseen {sum(1 for r in rs if r.get('unseen') and r.get('reached'))}, median survival {med([r['pdied'] if r['pdied'] is not None else r['dur'] for r in rs])} s, dmg median {med([r['dmg'] for r in rs])}, hits/s {round(sum(hps) / len(hps), 2)}, kills median {med([r['kills'] for r in rs])}, max tokens {max(r['maxTok'] for r in rs)}, tell min {min([r['teleMin'] for r in rs if r['teleMin'] is not None], default=None)}")
