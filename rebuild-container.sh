#!/bin/bash

echo "Rebuilding Docker container from scratch..."

# Stop and remove existing containers
docker-compose down
docker rmi jjcsf/season-ticket-manager:latest 2>/dev/null || true

# Build new image with complete React app
docker build -f Dockerfile.complete -t jjcsf/season-ticket-manager:complete .

# Start with new complete image
docker-compose -f docker-compose.complete.yml up -d

echo "Container rebuilt with complete React application"
echo "Access at: http://localhost:5050"