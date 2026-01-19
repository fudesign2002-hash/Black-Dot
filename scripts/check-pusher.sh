#!/usr/bin/env bash
set -eo pipefail

PIDFILE="server/pusher-auth.pid"

echo "Checking pusher-auth processes and listening ports..."

pids=()

# If pid file exists, check it first
if [[ -f "$PIDFILE" ]]; then
  pid=$(cat "$PIDFILE" 2>/dev/null || true)
  if [[ -n "$pid" ]] && ps -p "$pid" > /dev/null 2>&1; then
    pids+=("$pid")
  else
    echo "Note: $PIDFILE exists but PID $pid not running (stale file)."
  fi
fi

# Also search for any process matching pusher-auth (cjs/js) to be more flexible
while IFS= read -r line; do
  # line format: PID
  [[ -z "$line" ]] && continue
  if [[ ! " ${pids[*]} " =~ " $line " ]]; then
    pids+=("$line")
  fi
done < <(pgrep -f "pusher-auth" || true)

if [[ ${#pids[@]} -eq 0 ]]; then
  echo "No running pusher-auth process found by pidfile or pgrep."
  echo "Try: ps aux | grep pusher-auth"
  exit 1
fi

for pid in "${pids[@]}"; do
  echo "\nPID: $pid"
  ps -p "$pid" -o pid,comm,args || true
  echo "Listening ports (via lsof):"
  lsof -Pan -p "$pid" -iTCP -sTCP:LISTEN -n -P || echo "  (no listening TCP sockets found for PID $pid)"
  echo "Open network sockets (via lsof):"
  lsof -Pan -p "$pid" -i -n -P || true
done

exit 0
