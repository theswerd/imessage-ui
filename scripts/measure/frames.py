#!/usr/bin/env python3
"""Animation frame helpers for extracted 60fps PNG sequences.

  frames.py find DIR PREFIX [THRESH]          -> frames whose diff from the previous frame is large
  frames.py sheet DIR PREFIX START COUNT STEP OUT [X Y W H]   -> contact sheet (optionally cropped region), 8 per row
"""
import sys, glob
from PIL import Image, ImageChops, ImageStat, ImageDraw

cmd, d, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
files = sorted(glob.glob(f"{d}/{prefix}-*.png"))
if cmd == "find":
    thresh = float(sys.argv[4]) if len(sys.argv) > 4 else 3000
    prev = None; out = []
    for i, f in enumerate(files):
        im = Image.open(f).convert("L").resize((201, 437))
        if prev is not None:
            m = sum(ImageStat.Stat(ImageChops.difference(im, prev)).sum)
            if m > thresh: out.append((i, int(m)))
        prev = im
    print("frames with change >", thresh, ":", out[:60])
elif cmd == "sheet":
    start, count, step = int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]); out = sys.argv[7]
    region = tuple(int(v) for v in sys.argv[8:12]) if len(sys.argv) >= 12 else None
    sel = [i for i in range(start, min(len(files), start + count * step), step)]
    thumbs = []
    for i in sel:
        im = Image.open(files[i])
        if region: im = im.crop((region[0], region[1], region[0] + region[2], region[1] + region[3]))
        thumbs.append(im)
    tw, th = thumbs[0].size
    scale = min(1.0, 300 / tw)
    tw, th = int(tw * scale), int(th * scale)
    cols = 8; rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 4), rows * (th + 4)), (40, 40, 40))
    for k, (i, t) in enumerate(zip(sel, thumbs)):
        x = (k % cols) * (tw + 4); y = (k // cols) * (th + 4)
        sheet.paste(t.resize((tw, th)), (x, y)); ImageDraw.Draw(sheet).text((x + 3, y + 3), f"f{i} {i * 1000 / 60:.0f}ms", fill=(255, 0, 0))
    sheet.save(out); print(out, sheet.size, "frames", sel)
