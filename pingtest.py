import subprocess
import platform
import time
from datetime import datetime

# List of devices to ping
devices = [
    "10.31.0.1",
    "10.21.0.1",
    "www.iwcs.k12.va.us",
    "8.8.8.8"
]

def ping_device(host):
    param = "-n" if platform.system().lower() == "windows" else "-c"
    try:
        output = subprocess.check_output(["ping", param, "1", host], stderr=subprocess.STDOUT, universal_newlines=True)
        return True
    except subprocess.CalledProcessError:
        return False

if __name__ == "__main__":
    for device in devices:
        success = ping_device(device)
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if success:
            print(f"[{timestamp}] {device} is up")
        else:
            print(f"[{timestamp}] {device} is down or not responding")