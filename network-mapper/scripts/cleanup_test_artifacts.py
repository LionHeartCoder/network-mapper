"""
Cleanup script to remove test-created buildings and their floorplans/devices.
This targets buildings whose name contains 'E2E' or starts with 'E2E Icon Building'.
Run locally from project root: python scripts/cleanup_test_artifacts.py
It will remove DB rows and uploaded files (in backend/uploads) for matched artifacts.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Building, Floorplan, Device

DB_URL = os.environ.get('DATABASE_URL', 'sqlite:///network-mapper.db')
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)
UPLOADS = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'uploads')

def find_test_buildings(session):
    # match typical test artifact names
    return session.query(Building).filter(Building.name.like('E2E%')).all()

def remove_building(session, building):
    print(f"Removing building: {building.id} - {building.name}")
    fps = session.query(Floorplan).filter_by(building_id=building.id).all()
    for fp in fps:
        # delete uploads file if exists
        path = os.path.join(UPLOADS, fp.filename)
        if os.path.exists(path):
            print('  removing upload file', path)
            try:
                os.remove(path)
            except Exception as e:
                print('  failed to remove file', e)
        # delete devices linked to this floorplan
        devs = session.query(Device).filter_by(floorplan_id=fp.id).all()
        for d in devs:
            print('  removing device', d.id, d.name)
            session.delete(d)
        session.delete(fp)
    # also remove devices that reference the building (no floorplan)
    devs = session.query(Device).filter_by(building_id=building.id).all()
    for d in devs:
        print('  removing device (building-only)', d.id, d.name)
        session.delete(d)
    session.delete(building)

if __name__ == '__main__':
    s = Session()
    bs = find_test_buildings(s)
    if not bs:
        print('No test buildings found matching "E2E%"')
    else:
        print(f'Found {len(bs)} test buildings. Deleting...')
        for b in bs:
            remove_building(s, b)
        s.commit()
        print('Cleanup complete.')
    s.close()