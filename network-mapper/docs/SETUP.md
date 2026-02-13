# SETUP & RUNNING

## Requirements
- Docker & Docker Compose (recommended)
- Or Python 3.11+, pip, and a virtual environment

## Run with Docker (recommended)
1. From project root:
   ```bash
   docker compose build
   docker compose up -d
   ```
2. App will be available at `http://localhost:5000`.

Notes:
- The backend serves static frontend files; uploads are stored under `backend/uploads/` in the container.
- Default DB: uses `DATABASE_URL` env var (e.g., `sqlite:////tmp/network-mapper.db`). In the compose file DB is stored in container `/tmp` for simplicity.

## Run locally without Docker
1. Create venv and install:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```
2. Set env vars if needed:
   ```bash
   export FLASK_APP=backend/app.py
   export DATABASE_URL=sqlite:///network-mapper.db
   ```
3. Run:
   ```bash
   python backend/app.py
   ```

## Dev tips
- Uploads folder `backend/uploads/` must be writable.
- To reset DB for dev: delete DB file and restart container (or `rm -f /tmp/network-mapper.db` in container).
- Check logs with `docker compose logs -f`.

## Troubleshooting
- If ping endpoint fails with `ping-not-found`, ensure `iputils-ping` is installed in the container (the Dockerfile includes this). If running locally, ensure `ping` is on PATH.