#!/bin/zsh
set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="MorningReport"
APP_DIR="$WORKSPACE_DIR/${APP_NAME}.app"

# Clean any existing app bundle
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Info.plist template for Automator-style app
cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>English</string>
    <key>CFBundleExecutable</key>
    <string>MorningReport</string>
    <key>CFBundleIconFile</key>
    <string></string>
    <key>CFBundleIdentifier</key>
    <string>com.iwcs.MorningReport</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>MorningReport</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSAppleEventsUsageDescription</key>
    <string>MorningReport needs to automate web browsers to launch the dashboard.</string>
</dict>
</plist>
PLIST

# Generate the launcher script
cat > "$APP_DIR/Contents/MacOS/MorningReport" <<'SCRIPT'
#!/bin/zsh
set -euo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "$SELF_DIR/../.." && pwd)"
PROJECT_DIR="$(cd "$APP_ROOT" && pwd)"

# Relative path back to workspace (one level up from app bundle)
WORK_DIR="$(cd "$PROJECT_DIR" && pwd)"
cd "$WORK_DIR"

# Create and cache Python venv inside the app bundle resources so it travels with the app
env_root="$APP_ROOT/Resources/python"
venv_dir="$env_root/venv"
mkdir -p "$env_root"
if [ ! -d "$venv_dir" ]; then
  echo "Creating Python virtual environment..."
  /usr/bin/python3 -m venv "$venv_dir"
  source "$venv_dir/bin/activate"
  python -m pip install --upgrade pip >/dev/null
  pip install flask >/dev/null
else
  source "$venv_dir/bin/activate"
fi

# Start backend in background
python ping_backend.py &
BACK_PID=$!

cleanup() {
  if ps -p $BACK_PID > /dev/null 2>&1; then
    kill $BACK_PID >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT HUP INT TERM

sleep 1
open morningreport.html

# Keep script alive until browser tab closes (Safari preferred). If Safari not running, wait for manual exit.
if /usr/bin/pgrep -x Safari >/dev/null 2>&1; then
  /usr/bin/osascript <<'OSA'
set targetURL to "morningreport.html"
repeat
  delay 2
  tell application "Safari"
    if not (exists (first document whose URL contains targetURL)) then exit repeat
  end tell
end repeat
OSA
else
  read -s -k "??Press Enter in this terminal once you're done with Morning Report..." unused
fi
SCRIPT

chmod +x "$APP_DIR/Contents/MacOS/MorningReport"

echo "Created ${APP_NAME}.app in $WORKSPACE_DIR"
