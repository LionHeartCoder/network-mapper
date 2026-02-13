import os
import tempfile
import shutil
import pathlib
import sys
import pytest

# Ensure project root is importable when pytest collects from nested testpaths.
ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if sys.version_info >= (3, 13):
    pytest.skip(
        "tests/backend requires Python < 3.13 because pinned SQLAlchemy is not 3.13-compatible",
        allow_module_level=True,
    )

# Ensure test DB is set before importing the app module
tmpdir = tempfile.mkdtemp(prefix="nm_test_db_")
db_path = os.path.join(tmpdir, "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

# Import app after setting DATABASE_URL so engine uses test DB
from backend import app as app_module
from backend.models import Base

# Create tables in test DB
Base.metadata.create_all(app_module.engine)

@pytest.fixture(scope='session')
def client():
    app = app_module.app
    with app.test_client() as c:
        yield c

@pytest.fixture(scope='session', autouse=True)
def cleanup():
    yield
    # cleanup temporary DB directory
    try:
        shutil.rmtree(tmpdir)
    except Exception:
        pass
