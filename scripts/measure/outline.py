#!/usr/bin/env python3
"""Trace a solid-color bubble's outline from a reference PNG.

  outline.py IMG SEED_X SEED_Y SCALE [OUT.json]

Flood-fills the bubble color from the seed (tolerant, so subtle gradients are fine), then reports in points:
  bbox, height/width, corner radii (fit from the edge profile), and the full contour as a polyline
  (sub-pixel from anti-aliasing coverage) relative to the bubble's top-left, at 1 px resolution.
"""
import sys, json, math
from collections import deque
from PIL import Image

img = Image.open(sys.argv[1]).convert("RGB"); px = img.load(); W, H = img.size
sx, sy = int(sys.argv[2]), int(sys.argv[3]); scale = float(sys.argv[4])
target = px[sx, sy]
TOL = int(__import__("os").environ.get("OUTLINE_TOL", "40"))

def dist(c): return max(abs(c[i] - target[i]) for i in range(3))
def coverage(c, bg):
    # fraction of the way from bg toward target, using the channel with the largest contrast
    k = max(range(3), key=lambda i: abs(target[i] - bg[i]))
    if target[k] == bg[k]: return 0.0
    return max(0.0, min(1.0, (c[k] - bg[k]) / (target[k] - bg[k])))

# flood fill solid interior (tolerance 40 handles light gradients but not the anti-aliased rim)
seen = {(sx, sy)}; q = deque([(sx, sy)])
while q:
    x, y = q.popleft()
    for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and dist(px[nx, ny]) <= TOL:
            seen.add((nx, ny)); q.append((nx, ny))
xs = [p[0] for p in seen]; ys = [p[1] for p in seen]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
# background: sample just outside the bbox on the right middle
bg = px[min(W - 1, maxx + 6), (miny + maxy) // 2]

rows = {}
for y in range(miny, maxy + 1):
    row = sorted(x for (x, yy) in seen if yy == y)
    if not row: continue
    # segments (the tail can be separated from the body in the same row)
    segs = []; start = row[0]; prev = row[0]
    for x in row[1:]:
        if x != prev + 1: segs.append((start, prev)); start = x
        prev = x
    segs.append((start, prev))
    out = []
    for l, r in segs:
        lc = coverage(px[l - 1, y], bg) if l > 0 else 0
        rc = coverage(px[r + 1, y], bg) if r + 1 < W else 0
        out.append((round((l - lc - minx) / scale, 3), round((r + 1 + rc - minx) / scale, 3)))
    rows[y] = out
cols = {}
for x in range(minx, maxx + 1):
    col = sorted(y for (xx, y) in seen if xx == x)
    if not col: continue
    t, b = col[0], col[-1]
    tc = coverage(px[x, t - 1], bg) if t > 0 else 0
    bc = coverage(px[x, b + 1], bg) if b + 1 < H else 0
    cols[x] = (round((t - tc - miny) / scale, 3), round((b + 1 + bc - miny) / scale, 3))

wpt = (maxx - minx + 1) / scale; hpt = (maxy - miny + 1) / scale
print(f"bbox px x {minx}-{maxx} y {miny}-{maxy}; size {wpt:.2f} x {hpt:.2f} pt; color {'#%02x%02x%02x' % target}; bg {'#%02x%02x%02x' % bg}")

def fit_radius(profile):
    # profile: list of (d_along_edge, inset). Fit a circle r where inset = r - sqrt(r^2 - (r-d)^2) via least squares over r.
    best = None
    for r10 in range(40, 400):
        r = r10 / 10
        err = 0; n = 0
        for d, ins in profile:
            if d >= r: continue
            pred = r - math.sqrt(max(0, r * r - (r - d) * (r - d)))
            err += (pred - ins) ** 2; n += 1
        if n and (best is None or err / n < best[1]): best = (r, err / n)
    return best

# corner profiles (distance from the corner edge along the side, inset from the side)
left_top = [((y - miny) / scale, rows[y][0][0]) for y in range(miny, miny + int(30 * scale)) if y in rows]
right_top = [((y - miny) / scale, wpt - rows[y][-1][1]) for y in range(miny, miny + int(30 * scale)) if y in rows]
left_bottom = [((maxy - y) / scale, rows[y][0][0]) for y in range(maxy - int(30 * scale), maxy + 1) if y in rows]
right_bottom = [((maxy - y) / scale, wpt - rows[y][-1][1]) for y in range(maxy - int(30 * scale), maxy + 1) if y in rows]
for name, prof in (("top-left", left_top), ("top-right", right_top), ("bottom-left", left_bottom), ("bottom-right", right_bottom)):
    r = fit_radius(prof)
    print(f"{name}: radius ~{r[0]:.1f}pt (rmse {math.sqrt(r[1]):.2f})" if r else f"{name}: n/a")

if len(sys.argv) > 5:
    json.dump({"bbox_px": [minx, miny, maxx, maxy], "scale": scale, "width_pt": wpt, "height_pt": hpt,
               "rows": {str((y - miny) / scale): v for y, v in rows.items()},
               "cols": {str((x - minx) / scale): v for x, v in cols.items()}}, open(sys.argv[5], "w"))
    print("wrote", sys.argv[5])
