#!/bin/bash

# Build script for Container Station deployment with local authentication

echo "Building Season Ticket Manager for Container Station..."

# Set environment variables for container build
export NODE_ENV=production
export VITE_AUTH_TYPE=local

# Clean previous builds
rm -rf dist/

# Build frontend with local authentication
echo "Building frontend with local authentication..."
npm run build

# Verify frontend build
if [ ! -f "dist/index.html" ]; then
    echo "Error: Frontend build failed - dist/index.html not found"
    exit 1
fi

# Create proper directory structure for container
echo "Setting up container directory structure..."
mkdir -p dist/public
cp -r dist/* dist/public/

# Build server for container deployment
echo "Building container server..."
npx esbuild server/docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/docker.js

# Verify server build
if [ ! -f "dist/docker.js" ]; then
    echo "Error: Server build failed - dist/docker.js not found"
    exit 1
fi

echo "Build completed successfully!"
echo "Frontend: dist/public/"
echo "Server: dist/docker.js"
echo "Ready for Docker container build"