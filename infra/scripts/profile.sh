#!/bin/bash
# ATC API profiling script
echo "[ATC Profile] Starting CPU profile..."
NODE_ENV=production node --prof apps/api/dist/index.js &
PID=$!
sleep 30
kill -USR2 $PID 2>/dev/null
sleep 2
kill $PID
node --prof-process isolate-*.log > /tmp/atc-profile-$(date +%Y%m%d).txt
echo "[ATC Profile] Done: /tmp/atc-profile-$(date +%Y%m%d).txt"
