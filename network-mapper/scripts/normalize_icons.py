#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import csv
import re

SRC = Path(__file__).resolve().parents[0] / '..' / 'frontend' / 'icons' / 'from-pptx'
DST = Path(__file__).resolve().parents[0] / '..' / 'frontend' / 'icons' / 'standard'
SRC = SRC.resolve()
DST = DST.resolve()
DST.mkdir(parents=True, exist_ok=True)

def clean_name(name):
    # remove duplicate extensions and illegal chars
    name = name.replace('\\', '/').split('/')[-1]
    # remove trailing extra extensions like .png.png
    name = re.sub(r'(?i)\.png(\.png)*$', '.png', name)
    name = re.sub(r'[^0-9A-Za-z._-]+', '_', name)
    name = name.strip('_').lower()
    if not name.endswith('.png') and not name.endswith('.svg'):
        name = name + '.png'
    return name

rows = []
for p in sorted(SRC.glob('*')):
    if p.is_file():
        outname = clean_name(p.name)
        outpath = DST / outname
        # avoid collisions
        base = outpath.stem
        ext = outpath.suffix
        i = 1
        while outpath.exists():
            outpath = DST / f"{base}_{i}{ext}"
            i += 1
        # attempt to open and resize using Pillow; convert to RGBA
        try:
            im = Image.open(p).convert('RGBA')
            im.thumbnail((64,64), Image.LANCZOS)
            # center into 64x64 canvas
            canvas = Image.new('RGBA', (64,64), (0,0,0,0))
            x = (64 - im.width)//2
            y = (64 - im.height)//2
            canvas.paste(im, (x,y), im)
            canvas.save(outpath, format='PNG')
            rows.append({'src': str(p), 'out': str(outpath)})
        except Exception as e:
            # skip non-image or errors
            print('skip', p, e)

# write mapping csv
csvp = DST / 'mapping_normalized.csv'
with open(csvp, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['src','out'])
    writer.writeheader()
    for r in rows:
        writer.writerow(r)

print(f'Normalized {len(rows)} images to {DST} and wrote {csvp}')
