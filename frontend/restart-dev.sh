#!/bin/bash

echo "🔄 Restarting frontend dev server with cache clear..."

# Kill existing dev server
echo "Stopping existing dev server..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "No existing server found"

# Clear Vite cache
echo "Clearing Vite cache..."
rm -rf node_modules/.vite
rm -rf .vite
rm -rf dist

# Wait a moment
sleep 2

# Start dev server
echo "Starting dev server..."
npm run dev

echo "✅ Dev server restarted!"
