# python3 -I cmp.py dirA dirB [outdir]: mean abs diff per png present in both, side-by-side + amplified diff jpgs
import sys, os
from PIL import Image
import numpy as np
A, B = sys.argv[1], sys.argv[2]; O = sys.argv[3] if len(sys.argv) > 3 else None
if O: os.makedirs(O, exist_ok=True)
for n in sorted(f for f in os.listdir(A) if f.endswith('.png')):
    if not os.path.exists(os.path.join(B, n)): print(f'{n:34s} missing in B'); continue
    a = Image.open(os.path.join(A, n)).convert('RGB'); b = Image.open(os.path.join(B, n)).convert('RGB')
    if a.size != b.size: print(f'{n:34s} size differs {a.size} {b.size}'); continue
    x = np.asarray(a, dtype=np.int16); y = np.asarray(b, dtype=np.int16); d = np.abs(x - y)
    big = (d.max(axis=2) > 24).mean() * 100
    print(f'{n:34s} mean {d.mean():6.2f}  pix>24: {big:5.1f}%  meanRGB A {x.mean():6.1f} B {y.mean():6.1f}')
    if O:
        w, h = a.size; s = Image.new('RGB', (w * 3, h)); s.paste(a, (0, 0)); s.paste(b, (w, 0))
        s.paste(Image.fromarray(np.clip(d.max(axis=2) * 4, 0, 255).astype(np.uint8)).convert('RGB'), (w * 2, 0))
        s.resize((w * 3 // 2, h // 2)).save(os.path.join(O, n.replace('.png', '.jpg')), quality=85)
