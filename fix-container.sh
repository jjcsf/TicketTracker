#!/bin/bash

echo "Building corrected Season Ticket Manager container..."

# Stop existing containers
docker stop season-ticket-manager season-tickets-db 2>/dev/null || true
docker rm season-ticket-manager season-tickets-db 2>/dev/null || true

# Build new image with fixes
docker build -t jjcsf/season-ticket-manager:fixed .

# Verify the build includes frontend assets
echo "Verifying frontend assets in container..."
docker run --rm jjcsf/season-ticket-manager:fixed ls -la /app/dist/public/

echo "Container fixed and ready for deployment!"
echo "Use container-station-working.yml for deployment"