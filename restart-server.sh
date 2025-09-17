#!/bin/bash
echo "Stopping any existing server on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No server was running"

echo "Starting server with external access enabled..."
npm run dev 