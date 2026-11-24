# python3 -I sheet.py beforeDir afterDir out.jpg name1 name2 ...   (before | after rows, labelled)
import sys, os
from PIL import Image, ImageDraw
A, B, O = sys.argv[1:4]; names = sys.argv[4:]
W = 760
rows = []
for n in names:
    pa, pb = os.path.join(A, n + '.png'), os.path.join(B, n + '.png')
    if not (os.path.exists(pa) and os.path.exists(pb)): print('missing', n); continue
    a = Image.open(pa).convert('RGB'); b = Image.open(pb).convert('RGB')
    h = int(a.size[1] * W / a.size[0]) if a.size[0] >= a.size[1] else 520
    w = int(a.size[0] * h / a.size[1])
    a = a.resize((w, h)); b = b.resize((w, h))
    r = Image.new('RGB', (W * 2 + 12, h + 26), (24, 24, 28)); r.paste(a, (0, 26)); r.paste(b, (W + 12, 26))
    d = ImageDraw.Draw(r); d.text((6, 6), n + '  BEFORE', fill=(230, 230, 230)); d.text((W + 18, 6), n + '  AFTER', fill=(255, 220, 120))
    rows.append(r)
H = sum(r.size[1] for r in rows); S = Image.new('RGB', (W * 2 + 12, H), (24, 24, 28)); y = 0
for r in rows: S.paste(r, (0, y)); y += r.size[1]
S.save(O, quality=86); print(O, S.size)
