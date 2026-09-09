#!/usr/bin/env python3
"""Pixel measurement helpers for reference PNGs (pixel coordinates, not points).

  px.py at IMG X Y [X Y ...]           -> hex colors at points
  px.py row IMG Y X0 X1                 -> run-length colors along a row
  px.py col IMG X Y0 Y1                 -> run-length colors along a column
  px.py bbox IMG X Y [TOL]              -> bounding box of the contiguous region matching the color at (X,Y)
  px.py crop IMG X Y W H OUT [SCALE]    -> crop (and optionally upscale by integer SCALE) for inspection
  px.py hist IMG X Y W H [N]            -> top N colors in a region
"""
import sys
from collections import Counter, deque
from PIL import Image

def hexc(c): return "#%02x%02x%02x" % c[:3]
def load(p): return Image.open(p).convert("RGB")

def runs(vals):
    out, start, cur = [], 0, vals[0]
    for i, v in enumerate(vals[1:], 1):
        if v != cur: out.append((start, i - 1, cur)); start, cur = i, v
    out.append((start, len(vals) - 1, cur)); return out

cmd, img = sys.argv[1], load(sys.argv[2])
a = sys.argv[3:]
if cmd == "at":
    for i in range(0, len(a), 2): print(a[i], a[i+1], hexc(img.getpixel((int(a[i]), int(a[i+1])))))
elif cmd == "row":
    y, x0, x1 = int(a[0]), int(a[1]), int(a[2])
    for s, e, c in runs([hexc(img.getpixel((x, y))) for x in range(x0, x1)]): print(f"x {x0+s}-{x0+e} ({e-s+1}px) {c}")
elif cmd == "col":
    x, y0, y1 = int(a[0]), int(a[1]), int(a[2])
    for s, e, c in runs([hexc(img.getpixel((x, y))) for y in range(y0, y1)]): print(f"y {y0+s}-{y0+e} ({e-s+1}px) {c}")
elif cmd == "bbox":
    x, y = int(a[0]), int(a[1]); tol = int(a[2]) if len(a) > 2 else 6
    W, H = img.size; px = img.load(); target = px[x, y]
    ok = lambda c: all(abs(c[i] - target[i]) <= tol for i in range(3))
    seen = {(x, y)}; q = deque([(x, y)]); minx = maxx = x; miny = maxy = y
    while q:
        cx, cy = q.popleft(); minx, maxx, miny, maxy = min(minx, cx), max(maxx, cx), min(miny, cy), max(maxy, cy)
        for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and ok(px[nx, ny]): seen.add((nx, ny)); q.append((nx, ny))
    print(f"color {hexc(target)} bbox x {minx}-{maxx} y {miny}-{maxy} size {maxx-minx+1}x{maxy-miny+1} px, area {len(seen)}")
elif cmd == "crop":
    x, y, w, h = map(int, a[:4]); out = a[4]; scale = int(a[5]) if len(a) > 5 else 1
    c = img.crop((x, y, x + w, y + h))
    if scale > 1: c = c.resize((w * scale, h * scale), Image.NEAREST)
    c.save(out); print(out, c.size)
elif cmd == "hist":
    x, y, w, h = map(int, a[:4]); n = int(a[4]) if len(a) > 4 else 8
    cnt = Counter(hexc(img.getpixel((i, j))) for i in range(x, x + w) for j in range(y, y + h))
    for c, k in cnt.most_common(n): print(c, k)
else:
    print(__doc__)
