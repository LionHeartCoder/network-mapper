#!/bin/zsh
# Start Flask backend in background
python3 ping_backend.py &
# Wait a moment for server to start
sleep 2
# Open the HTML file in your default browser
open morningreport.html
