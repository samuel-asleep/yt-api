#!/bin/bash

echo "Starting Tor service..."
tor &

echo "Waiting for Tor to initialize..."
sleep 10

echo "Checking Tor connection..."
for i in {1..30}; do
    if curl --socks5-hostname 127.0.0.1:9050 -s https://check.torproject.org/api/ip | grep -q "IsTor.*true"; then
        echo "Tor is connected!"
        break
    fi
    echo "Waiting for Tor... attempt $i"
    sleep 2
done

echo "Starting Node.js application..."
exec node index.js
