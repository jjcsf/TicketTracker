#!/bin/bash

echo "Testing Season Ticket Manager Static Container Deployment"
echo "========================================================"

# Build the static container
echo "Building static container server..."
npx esbuild server/static-container.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/static-container.js

# Check build success
if [ ! -f "dist/static-container.js" ]; then
    echo "ERROR: Static container build failed"
    exit 1
fi

echo "✓ Static container built successfully"

# Start container with environment variables
echo "Starting static container on port 5051..."
cd dist
DATABASE_URL="postgresql://season_user:season_pass@localhost:5432/season_tickets_db" \
SESSION_SECRET="test-secret-key-12345" \
PORT=5051 \
node static-container.js > /tmp/static-test.log 2>&1 &

CONTAINER_PID=$!
echo "Container PID: $CONTAINER_PID"

# Wait for startup
sleep 3

# Test API endpoints
echo "Testing API endpoints..."

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s http://localhost:5051/api/test || echo "Health test failed"

# Test HTML interface
echo "2. Testing HTML interface..."
curl -s http://localhost:5051/ | head -10 || echo "HTML test failed"

# Test authentication endpoint
echo "3. Testing auth endpoint..."
curl -s http://localhost:5051/api/auth/user || echo "Auth test failed"

# Show logs
echo "Container logs:"
cat /tmp/static-test.log

# Cleanup
kill $CONTAINER_PID 2>/dev/null

echo "Test completed."