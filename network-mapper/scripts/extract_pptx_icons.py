#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET
import re
from pathlib import Path
import csv

PPTX = Path(__file__).resolve().parents[1] / 'iconlibrary-production-oct2016.pptx'
OUTDIR = Path(__file__).resolve().parents[0] / '..' / 'frontend' / 'icons' / 'from-pptx'
OUTDIR.mkdir(parents=True, exist_ok=True)

ns = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

def clean_name(s):
    # try to sanitize and shorten
    s = s.replace('\\', '/').split('/')[-1]
    s = re.sub(r'[^0-9A-Za-z._-]+', '_', s)
    s = s.strip('_').lower()
    return s or 'icon'

mappings = []
with zipfile.ZipFile(PPTX, 'r') as z:
    # list all slides
    slide_files = [f for f in z.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')]
    for slide in slide_files:
        rels_name = 'ppt/slides/_rels/' + Path(slide).name + '.rels'
        rels = {}
        if rels_name in z.namelist():
            tree = ET.fromstring(z.read(rels_name))
            for rel in tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
                rid = rel.get('Id')
                target = rel.get('Target')
                rels[rid] = target
        data = z.read(slide)
        tree = ET.fromstring(data)
        # find pics
        for pic in tree.findall('.//p:pic', ns):
            # find descriptor
            cNvPr = pic.find('.//p:cNvPr', ns)
            desc = ''
            if cNvPr is not None:
                desc = cNvPr.get('descr') or cNvPr.get('name') or ''
            # find blip r:embed
            blip = pic.find('.//a:blip', ns)
            rid = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed') if blip is not None else None
            target = rels.get(rid) if rid else None
            if target and target.startswith('../'):
                target = target.replace('../','')
            if target:
                src_name = 'ppt/' + target
                if src_name in z.namelist():
                    # build friendly name
                    friendly = clean_name(desc)
                    ext = Path(target).suffix
                    out_name = friendly + ext
                    out_path = OUTDIR / out_name
                    # avoid collisions
                    count = 1
                    while out_path.exists():
                        out_path = OUTDIR / f"{friendly}_{count}{ext}"
                        count += 1
                    with z.open(src_name) as src, open(out_path, 'wb') as dst:
                        dst.write(src.read())
                    mappings.append({'slide': slide, 'rId': rid, 'src': src_name, 'desc': desc, 'out': str(out_path.relative_to(Path.cwd()))})

# write CSV
csv_path = OUTDIR / 'mapping.csv'
with open(csv_path, 'w', newline='', encoding='utf-8') as csvf:
    writer = csv.DictWriter(csvf, fieldnames=['slide','rId','src','desc','out'])
    writer.writeheader()
    for m in mappings:
        writer.writerow(m)

print(f'Extracted {len(mappings)} images to {OUTDIR} and wrote mapping to {csv_path}')
