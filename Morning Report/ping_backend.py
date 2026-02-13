import os
from flask import Flask, request, jsonify
import subprocess
import platform
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse
from typing import Optional

app = Flask(__name__)


def resolve_ping_binary():
    """Locate the system ping executable across platforms."""
    ping_path = shutil.which("ping")
    if ping_path:
        return ping_path

    # Fallbacks for common UNIX locations
    for candidate in ("/sbin/ping", "/bin/ping", "/usr/bin/ping"):
        if Path(candidate).exists():
            return candidate
    return None


PING_BINARY = resolve_ping_binary()


def normalize_target(target: Optional[str]) -> Optional[str]:
    """Strip protocols and ports so the ping command receives a host/IP only."""
    if not target:
        return None

    cleaned = target.strip()
    if not cleaned:
        return None

    if cleaned.startswith(("http://", "https://")):
        parsed = urlparse(cleaned)
        host = parsed.hostname
        return host

    # Remove any trailing paths or ports if accidentally provided
    if '/' in cleaned:
        cleaned = cleaned.split('/', 1)[0]
    if ':' in cleaned and cleaned.count(':') == 1:
        cleaned = cleaned.split(':', 1)[0]

    return cleaned


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET"
    return response


@app.route('/health')
def health():
    """Simple health probe to confirm the service is alive."""
    status = {
        "status": "ok",
        "pingBinary": bool(PING_BINARY)
    }
    code = 200 if PING_BINARY else 503
    return jsonify(status), code


@app.route('/whoami')
def whoami():
    """Return the full name of the logged-in macOS user using `id -F`."""
    try:
        name = subprocess.check_output(['id', '-F'], text=True).strip()
        if not name:
            raise ValueError('empty-name')
        return jsonify({"name": name})
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        return jsonify({"error": "unavailable"}), 503

@app.route('/ping')
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

if __name__ == "__main__":
    host = os.environ.get("PING_BACKEND_HOST", "0.0.0.0")
    port = int(os.environ.get("PING_BACKEND_PORT", "5000"))
    app.run(host=host, port=port)
