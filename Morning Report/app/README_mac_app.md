# MorningReport.app (macOS Self-Contained Launcher)

This app bundle lets any team member launch the Morning Report dashboard with zero manual Python or Flask setup. It creates its own Python virtual environment, installs Flask, starts the backend, and opens the HTML dashboard in the default browser.

## How to build the app bundle

1. Open Terminal and run:

```zsh
cd "/Users/bkoury/Documents/VS Code/Morning Report/app"
zsh create_app.sh
```

2. This creates `MorningReport.app` in the parent folder. You can copy this `.app` to any Mac.

## How to use

- Double-click `MorningReport.app` to launch the dashboard.
- The backend runs in the background and is automatically cleaned up when you close the browser tab.
- No need to install Python or Flask system-wide—everything is self-contained.

## Notes
- The first launch may take a minute to set up the Python environment and install Flask.
- The app works best with Safari (auto-detects tab close). For other browsers, you can manually exit via Terminal.
- If you move the app, keep it in the same folder as the `Morning Report` files for best results.
