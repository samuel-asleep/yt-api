#!/bin/bash

echo "Starting Tor..."
tor &
TOR_PID=$!

sleep 5

if kill -0 $TOR_PID 2>/dev/null; then
    echo "Tor started successfully (PID: $TOR_PID)"
    echo "Tor SOCKS5 proxy available at socks5://127.0.0.1:9050"
else
    echo "Warning: Tor may not have started correctly"
fi

echo "Starting Node.js server..."
node index.js
