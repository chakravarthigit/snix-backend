#!/bin/bash

# Make sure we're in the backend directory
cd "$(dirname "$0")"

echo "🔍 Testing MongoDB connection..."
node test-mongodb.js

# Check if the MongoDB test was successful
if [ $? -ne 0 ]; then
  echo "❌ MongoDB connection test failed. Please check your connection string and try again."
  exit 1
fi

# Install required dependencies
echo "📦 Installing required dependencies..."
npm install

# Start the server
echo "🚀 Starting the server..."
npm run dev 