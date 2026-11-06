#!/usr/bin/env python3
"""Showroom Designer floor sprites: trim the owner package's transparent margins so each picture fills its
placement box (owner request 2026-11-06). Source = the untouched package files (git history / the v2 ZIP).

  python3 scripts/showroom-trim-sprites.py <package floorplan dir> public/assets/showroom/floorplan docs/showroom/showroom_equipment_manifest.json

- crop to the picture (alpha > 8), keep a 3% transparent margin so it never touches the dashed box edge
- a picture whose long side runs ACROSS its box's long side (stairlifts / ramps: drawn left-to-right in a tall
  box) is turned 90 degrees so its length runs along the box
- the engine draws every sprite with object-fit: contain in the item's own box, so the picture fills the box on
  its limiting side and is never stretched"""
import json, sys, os
from PIL import Image
src, dst, man = sys.argv[1:4]
for e in json.load(open(man)):
    f = os.path.basename(e['floorplan_path'])
    im = Image.open(os.path.join(src, f)).convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    art = im.crop(bb)
    box_land = e['width_cells'] > e['height_cells']; art_land = art.width > art.height
    if e['width_cells'] != e['height_cells'] and box_land != art_land and max(art.size) / min(art.size) > 1.3:
        art = art.rotate(-90, expand=True)
    m = max(2, round(max(art.size) * 0.03))
    out = Image.new('RGBA', (art.width + 2 * m, art.height + 2 * m), (0, 0, 0, 0)); out.paste(art, (m, m))
    out.save(os.path.join(dst, f), optimize=True)
    print(f"{e['id']:26s} {im.size} -> {out.size}")
