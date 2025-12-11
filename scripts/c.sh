#!/usr/bin/env bash
set -euo pipefail

# Simple helper to commit and optionally push
# Usage: c.sh "commit message" [p]

MSG="$1"
PUSH_FLAG="$2"

if [ -z "$MSG" ]; then
  echo "Usage: c.sh \"commit message\" [p]"
  exit 1
fi

# Stage all changes
git add -A

# Check if there is anything to commit
if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$MSG"
  echo "Committed: $MSG"
fi

# Push if requested
if [ "$PUSH_FLAG" = "p" ] || [ "$PUSH_FLAG" = "--push" ]; then
  echo "Pushing to origin HEAD..."
  git push
  echo "Pushed."
else
  echo "Not pushing (no 'p' flag provided)."
fi
