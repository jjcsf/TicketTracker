#!/bin/bash

echo "Rebuilding Season Ticket Manager Docker image with static file fixes..."

# Build the updated Docker image
docker build -t jjcsf/season-ticket-manager:latest .

echo "Docker image rebuilt successfully!"
echo ""
echo "To update your Container Station deployment:"
echo "1. Stop the current containers"
echo "2. Pull the updated image: docker pull jjcsf/season-ticket-manager:latest"
echo "3. Restart your compose deployment"
echo ""
echo "Or use this command to rebuild and push to registry:"
echo "docker push jjcsf/season-ticket-manager:latest"