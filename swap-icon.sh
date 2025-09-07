#!/bin/bash

# Simple script to swap between dev and production icons

if [ "$1" = "dev" ]; then
  echo "Switching to dev icon..."
  cp assets/icon-dev.png assets/icon.png
  cp assets/adaptive-icon-dev.png assets/adaptive-icon.png
  echo "✅ Dev icon is now active"
elif [ "$1" = "prod" ]; then
  echo "Switching to production icon..."
  cp "assets/icon Exports/icon-iOS-Default-1024x1024@1x.png" assets/icon.png
  cp "assets/icon Exports/icon-iOS-Default-1024x1024@1x.png" assets/adaptive-icon.png
  echo "✅ Production icon is now active"
else
  echo "Usage: ./swap-icon.sh [dev|prod]"
  echo "  dev  - Use the dev icon"
  echo "  prod - Use the production icon"
fi