#!/bin/bash
echo "🦅 Wachtpost actief op http://localhost:4000"
while true; do
  python3 -m http.server 4000
  echo "Server gestopt, herstart over 1 seconde..."
  sleep 1
done
