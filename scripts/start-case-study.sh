#!/bin/bash

# Start the case study - brings up database and backend

set -e

echo "🚀 Starting Appostrophe Backend Case Study..."
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Start database
echo "📦 Starting PostgreSQL database..."
docker compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if docker compose exec -T db pg_isready -U postgres -d appostrophe > /dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Database failed to start after ${max_attempts} seconds"
  exit 1
fi

# Give it a moment for init scripts to run
sleep 2

# Start backend
echo ""
echo "🔧 Starting backend server..."
echo "   Server will be available at http://localhost:5003"
echo "   Press Ctrl+C to stop"
echo ""

# Start node in foreground so user can see logs and stop with Ctrl+C
node index.js
