#!/bin/bash

# Docker Repository Publishing Script for Season Ticket Manager

# Configuration - Updated with your Docker Hub username
DOCKER_USERNAME="jjcsf"
IMAGE_NAME="season-ticket-manager"
VERSION="latest"

echo "🏗️  Building Season Ticket Manager Docker Image..."

# Build the image using the fixed Dockerfile
docker build -f Dockerfile.simple -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} .

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
    
    echo "🔐 Logging into Docker Hub..."
    docker login
    
    if [ $? -eq 0 ]; then
        echo "📤 Pushing image to Docker Hub..."
        docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
        
        if [ $? -eq 0 ]; then
            echo "✅ Successfully published to Docker Hub!"
            echo "📋 Your image is now available as: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
            echo ""
            echo "To use in Container Station:"
            echo "services:"
            echo "  app:"
            echo "    image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
            echo "    ports:"
            echo "      - \"5050:5050\""
        else
            echo "❌ Failed to push image"
            exit 1
        fi
    else
        echo "❌ Docker login failed"
        exit 1
    fi
else
    echo "❌ Build failed"
    exit 1
fi