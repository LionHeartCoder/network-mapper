import os
import platform
import re
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
try:
    from models import Base, Building, Floorplan, Device
except Exception:
    # support running as module (gunicorn backend.app:app)
    from backend.models import Base, Building, Floorplan, Device
from dotenv import load_dotenv
import csv
import io

load_dotenv()

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# set static folder to the top-level frontend directory so static files are found
STATIC_FOLDER = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='')
CORS(app)

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///network-mapper.db')
engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine)
# Create tables but tolerate race conditions or existing tables when multiple workers boot
from sqlalchemy.exc import OperationalError
try:
    Base.metadata.create_all(engine)
except OperationalError as e:
    # On some environments multiple workers may attempt DDL simultaneously; ignore if tables already exist.
    print('Warning: create_all raised OperationalError:', e)
# --- Reused ping helpers (adapted) ---

def resolve_ping_binary():
    ping_path = shutil.which("ping")
    if ping_path:
        return ping_path
    for candidate in ("/sbin/ping", "/bin/ping", "/usr/bin/ping"):
        if Path(candidate).exists():
            return candidate
    return None

PING_BINARY = resolve_ping_binary()


def normalize_target(target):
    if not target:
        return None
    cleaned = target.strip()
    if not cleaned:
        return None
    if cleaned.startswith(("http://", "https://")):
        parsed = urlparse(cleaned)
        return parsed.hostname
    if '/' in cleaned:
        cleaned = cleaned.split('/', 1)[0]
    if ':' in cleaned and cleaned.count(':') == 1:
        cleaned = cleaned.split(':', 1)[0]
    return cleaned

# --- Health endpoints ---
@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "pingBinary": bool(PING_BINARY)})

# Serve frontend
@app.route('/')
def index():
    return app.send_static_file('index.html')

# Ping endpoint
@app.route('/api/ping')
def ping():
    raw_target = request.args.get('ip', '')
    target = normalize_target(raw_target)
    if not target:
        return jsonify({"success": False, "error": "invalid-target"}), 400
    if not PING_BINARY:
        return jsonify({"success": False, "error": "ping-not-found"}), 500
    param = "-n" if platform.system().lower() == "windows" else "-c"
    cmd = [PING_BINARY, param, "1", target]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
        success = result.returncode == 0
        time_ms = None
        error = None
        if success:
            match = re.search(r'time[=<]([0-9]+)ms', result.stdout)
            if match:
                time_ms = match.group(1)
        else:
            error = "no-response"
        return jsonify({"success": success, "time": time_ms, "error": error})
    except Exception:
        return jsonify({"success": False, "error": "exception"})

# --- Buildings endpoints (for master map) ---
@app.route('/api/buildings', methods=['GET', 'POST'])
def buildings():
    session = SessionLocal()
    if request.method == 'GET':
        bs = session.query(Building).all()
        out = [{"id": b.id, "name": b.name, "lat": b.lat, "lon": b.lon} for b in bs]
        session.close()
        return jsonify(out)
    data = request.json
    if not data or not data.get('name'):
        return jsonify({"error": "name required"}), 400
    b = Building(name=data['name'], lat=data.get('lat'), lon=data.get('lon'))
    session.add(b)
    session.commit()
    b_id = b.id
    session.close()
    return jsonify({"id": b_id})

# --- File upload for floorplans ---
@app.route('/api/floorplans', methods=['GET', 'POST'])
def floorplans():
    session = SessionLocal()
    if request.method == 'GET':
        fps = session.query(Floorplan).all()
        out = [
            {"id": f.id, "building_id": f.building_id, "filename": f.filename, "created": f.created.isoformat()} for f in fps
        ]
        session.close()
        return jsonify(out)

    file = request.files.get('file')
    building = request.form.get('building')
    if not file or not building:
        return jsonify({"error": "file and building required"}), 400
    filename = file.filename
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)
    # ensure building exists or create
    b = session.query(Building).filter_by(name=building).one_or_none()
    if not b:
        b = Building(name=building)
        session.add(b)
        session.commit()
    fp = Floorplan(building_id=b.id, filename=filename)
    session.add(fp)
    session.commit()
    fp_id = fp.id
    session.close()
    return jsonify({"id": fp_id, "filename": filename})

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# --- Devices CRUD ---
@app.route('/api/devices', methods=['GET', 'POST'])
def devices():
    session = SessionLocal()
    if request.method == 'GET':
        devices = session.query(Device).all()
        out = [
            {"id": d.id, "name": d.name, "ip": d.ip, "device_type": d.device_type, "building_id": d.building_id, "floorplan_id": d.floorplan_id, "x": d.x, "y": d.y, "note": d.note, "mac": d.mac, "room": d.room} for d in devices
        ]
        session.close()
        return jsonify(out)
    data = request.json
    d = Device(name=data.get('name'), ip=data.get('ip'), device_type=data.get('device_type'), building_id=data.get('building_id'), floorplan_id=data.get('floorplan_id'), x=data.get('x'), y=data.get('y'), note=data.get('note'), mac=data.get('mac'), room=data.get('room'))
    session.add(d)
    session.commit()
    d_id = d.id
    session.close()
    return jsonify({"id": d_id})

@app.route('/api/devices/<int:device_id>', methods=['GET','PUT', 'DELETE'])
def device_modify(device_id):
    session = SessionLocal()
    d = session.get(Device, device_id)
    if not d:
        session.close()
        return jsonify({"error": "not-found"}), 404
    if request.method == 'DELETE':
        # snapshot before delete
        snapshot = {"id": d.id, "name": d.name, "ip": d.ip, "device_type": d.device_type, "building_id": d.building_id, "floorplan_id": d.floorplan_id, "x": d.x, "y": d.y, "note": d.note, "mac": d.mac, "room": d.room}
        session.delete(d)
        session.commit()
        session.close()
        return jsonify({"status": "deleted", "snapshot": snapshot})
    if request.method == 'GET':
        out = {"id": d.id, "name": d.name, "ip": d.ip, "device_type": d.device_type, "building_id": d.building_id, "floorplan_id": d.floorplan_id, "x": d.x, "y": d.y, "note": d.note, "mac": d.mac, "room": d.room}
        session.close()
        return jsonify(out)
    data = request.json
    # store previous state for snapshot
    prev = {"id": d.id, "name": d.name, "ip": d.ip, "device_type": d.device_type, "building_id": d.building_id, "floorplan_id": d.floorplan_id, "x": d.x, "y": d.y, "note": d.note}
    for k in ('name', 'ip', 'device_type', 'building_id', 'floorplan_id', 'x', 'y', 'note', 'mac', 'room'):
        if k in data:
            setattr(d, k, data[k])
    session.add(d)
    session.commit()
    session.close()
    return jsonify({"status": "updated", "prev": prev})

# --- Icons management endpoints ---
@app.route('/api/icons/list')
def icons_list():
    icons_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'icons', 'standard')
    icons_dir = os.path.normpath(icons_dir)
    if not os.path.isdir(icons_dir):
        return jsonify([])
    files = sorted([f for f in os.listdir(icons_dir) if os.path.isfile(os.path.join(icons_dir, f))])
    return jsonify(files)

@app.route('/api/icons/apply', methods=['POST'])
def icons_apply():
    data = request.json or {}
    icon = data.get('icon')
    target = data.get('target')
    allowed = {'switch','ap','phone','camera','device'}
    if not icon or not target or target not in allowed:
        return jsonify({"error":"invalid"}), 400
    # sanitize icon filename
    icon_name = os.path.basename(icon)
    src = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'icons', 'standard', icon_name)
    src = os.path.normpath(src)
    dst = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'icons', f"{target}.png")
    dst = os.path.normpath(dst)
    if not os.path.exists(src):
        return jsonify({"error":"not-found"}), 404
    try:
        shutil.copyfile(src, dst)
        # Also write a small SVG wrapper that references the PNG so the UI (which prefers SVG) will show the new icon
        try:
            wrapper_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <image href="{target}.png" width="64" height="64"/>
</svg>'''
            dst_svg = os.path.splitext(dst)[0] + '.svg'
            with open(dst_svg, 'w') as wf:
                wf.write(wrapper_svg)
        except Exception as e2:
            # non-fatal: log and continue
            print('Warning: failed to write svg wrapper for icon apply', e2)
        return jsonify({"status":"ok", "target": target})
    except Exception as e:
        return jsonify({"error":"copy-failed", "detail": str(e)}), 500

# --- CSV import endpoint ---
@app.route('/api/devices/import', methods=['POST'])
def import_devices():
    session = SessionLocal()
    f = request.files.get('file')
    if not f:
        return jsonify({"error": "file required"}), 400
    stream = io.StringIO(f.stream.read().decode('utf-8'))
    reader = csv.DictReader(stream)
    created = 0
    for row in reader:
        name = row.get('name') or row.get('hostname') or row.get('device')
        # ensure `name` is never None because Device.name is NOT NULL
        name = name or ''
        ip = row.get('ip') or row.get('address')
        dtype = row.get('type') or row.get('device_type') or 'unknown'
        building_name = row.get('building')
        building = None
        if building_name:
            building = session.query(Building).filter_by(name=building_name).one_or_none()
            if not building:
                building = Building(name=building_name)
                session.add(building)
                session.commit()
        d = Device(name=name, ip=ip, device_type=dtype, building_id=building.id if building else None)
        session.add(d)
        created += 1
    session.commit()
    session.close()
    return jsonify({"created": created})

# --- Admin helper: cleanup test artifacts ---
@app.route('/api/admin/cleanup-tests', methods=['POST'])
def admin_cleanup_tests():
    token = os.environ.get('ADMIN_TOKEN')
    provided = request.headers.get('X-Admin-Token') or request.args.get('token')
    if not token or provided != token:
        return jsonify({"error": "unauthorized"}), 403
    session = SessionLocal()
    # find buildings whose name starts with or contains E2E
    targets = session.query(Building).filter(Building.name.like('E2E%')).all()
    removed = 0
    for b in targets:
        fps = session.query(Floorplan).filter_by(building_id=b.id).all()
        for fp in fps:
            # attempt to remove uploaded file
            path = os.path.join(UPLOAD_FOLDER, fp.filename)
            try:
                if os.path.exists(path): os.remove(path)
            except Exception as e:
                print('failed to remove', path, e)
            # remove devices for this floorplan
            session.query(Device).filter_by(floorplan_id=fp.id).delete()
            session.delete(fp)
        # remove devices referencing building
        session.query(Device).filter_by(building_id=b.id).delete()
        session.delete(b)
        removed += 1
    session.commit()
    session.close()
    return jsonify({"removed_buildings": removed})

# NOTE: duplicate CSV-import handler (previously present here) was removed because it
# was unreachable and duplicated the behavior implemented in `import_devices()` above.

# --- Restore endpoint -----------------------------------------------------
# Restore a previously-snapshotted device row. If the snapshot contains an `id`
# and that id is free the server will attempt to re-create the row with the same
# primary key. If the id is already taken the server will create a new row and
# return the new id (preservedId=false).
@app.route('/api/devices/restore', methods=['POST'])
def devices_restore():
    session = SessionLocal()
    data = request.json or {}
    # accept either { "snapshot": {...} } or a bare snapshot object
    snap = data.get('snapshot') if isinstance(data.get('snapshot'), dict) else (data if isinstance(data, dict) else None)
    if not snap:
        return jsonify({"error": "snapshot-required"}), 400

    allowed_keys = ('id','name','ip','device_type','building_id','floorplan_id','x','y','note','mac','room')
    payload = {k: snap.get(k) for k in allowed_keys if k in snap}
    desired_id = payload.get('id')

    try:
        # attempt to preserve original id if provided and available
        if desired_id is not None:
            existing = session.get(Device, desired_id)
            if existing is None:
                # insert with explicit id
                d = Device(**payload)
                session.add(d)
                session.commit()
                new_id = d.id
                session.close()
                return jsonify({"restored": True, "id": new_id, "preservedId": True})
        # fallback — create normally (autoincrement id)
        d = Device(
            name=payload.get('name'),
            ip=payload.get('ip'),
            device_type=payload.get('device_type') or 'unknown',
            building_id=payload.get('building_id'),
            floorplan_id=payload.get('floorplan_id'),
            x=payload.get('x'),
            y=payload.get('y'),
            note=payload.get('note'),
            mac=payload.get('mac'),
            room=payload.get('room')
        )
        session.add(d)
        session.commit()
        new_id = d.id
        session.close()
        return jsonify({"restored": True, "id": new_id, "preservedId": False})
    except Exception as e:
        session.rollback()
        session.close()
        return jsonify({"error": "restore-failed", "detail": str(e)}), 500

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', '5000'))
    app.run(host=host, port=port, debug=True)
