"""
Apply curated icons to core device types by selecting the first matching icon from /api/icons/list.
Usage: python scripts/apply_curated_icons.py --base http://localhost:5000 --token <ADMIN_TOKEN>
"""
import sys, requests
from argparse import ArgumentParser

parser = ArgumentParser()
parser.add_argument('--base', default='http://localhost:5000')
parser.add_argument('--token', default=None)
args = parser.parse_args()
BASE = args.base
HEADERS = {'X-Admin-Token': args.token} if args.token else {}

res = requests.get(BASE + '/api/icons/list')
if not res.ok:
    print('Failed to get icons list', res.status_code, res.text); sys.exit(1)
icons = res.json()
print('Found', len(icons), 'icons')

def pick(name_subs):
    low = [i for i in icons if any(s in i.lower() for s in name_subs)]
    return low[0] if low else None

mapping = {
    'switch': pick(['switch','route','device','hub']),
    'ap': pick(['access-point','access_point','ap','dual-band-access-point','wireless']),
    'phone': pick(['phone','ata','cucm','voice','ip_phone']),
    'camera': pick(['camera','video','telepresence','webcam','ip_cam'])
}

for target, icon in mapping.items():
    print('target', target, '->', icon)
    if not icon:
        print('  no candidate found')
        continue
    r = requests.post(BASE + '/api/icons/apply', json={'icon': icon, 'target': target}, headers=HEADERS)
    print('  apply status', r.status_code, r.text)

print('Done')