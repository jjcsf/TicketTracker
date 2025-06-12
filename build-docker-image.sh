#!/bin/bash
# Build and publish Docker image for Season Ticket Manager

echo "Building Season Ticket Manager Docker Image..."

# Build the image
docker build -f Dockerfile.prebuilt -t season-ticket-manager:latest .

# Tag for Docker Hub (replace 'yourusername' with actual Docker Hub username)
docker tag season-ticket-manager:latest yourusername/season-ticket-manager:latest

# Push to Docker Hub
# docker push yourusername/season-ticket-manager:latest

echo "Image built successfully!"
echo "To use the image, run:"
echo "docker run -p 5050:5050 -e DATABASE_URL=your_db_url season-ticket-manager:latest"