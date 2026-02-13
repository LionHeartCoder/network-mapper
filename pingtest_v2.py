import subprocess
import platform
import time
from datetime import datetime
import csv
import os

# Interval in seconds between pings
interval = 30

# List of devices to ping
devices = [
    "10.31.0.1",
    "10.21.0.1",
    "www.iwcs.k12.va.us",
    "8.8.8.8"
]

# CSV log file
log_file = "ping_log.csv"

# Determine ping command based on OS
param = "-n" if platform.system().lower() == "windows" else "-c"

def ping_device(host):
    try:
        # Run the ping command
        start = time.time()
        output = subprocess.check_output(["ping", param, "1", host], stderr=subprocess.STDOUT, universal_newlines=True)
        end = time.time()
        elapsed = round((end - start) * 1000, 2)  # ms
        return True, elapsed
    except subprocess.CalledProcessError as e:
        return False, None

def log_result_csv(timestamp, host, status, response_time_ms):
    file_exists = os.path.isfile(log_file)
    with open(log_file, mode='a', newline='') as csvfile:
        fieldnames = ['timestamp', 'host', 'status', 'response_time_ms']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            'timestamp': timestamp,
            'host': host,
            'status': status,
            'response_time_ms': response_time_ms if response_time_ms is not None else ''
        })

def log_result(host, success, elapsed):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if success:
        status = "up"
        log_line = f"[{timestamp}] {host} is up - Response time: {elapsed} ms"
        response_time = elapsed
    else:
        status = "down"
        log_line = f"[{timestamp}] {host} is down or not responding"
        response_time = None
    
    print(log_line)
    log_result_csv(timestamp, host, status, response_time)

# Main logic
if __name__ == "__main__":
    while True:
        for device in devices:
            success, elapsed = ping_device(device)
            log_result(device, success, elapsed)
        time.sleep(interval)