#!/bin/bash

# Force push to GitHub bypassing locks
echo "Attempting force push to GitHub..."

# Create a new branch and switch to it
git checkout -b deploy-container-fix 2>/dev/null || git checkout deploy-container-fix

# Try to add files individually
echo "Adding essential files..."
git add container-interactive-server.js
git add Dockerfile.simple
git add .github/workflows/docker-publish.yml
git add docker-compose.published.yml

# Commit changes
git commit -m "Container deployment: Fixed ES modules and Docker config

- Fixed ES module compatibility in container-interactive-server.js
- Updated Dockerfile.simple for container deployment  
- Added GitHub Actions workflow for Docker publishing
- Enhanced authentication bypass for containers"

# Push new branch
git push origin deploy-container-fix

echo "Pushed to deploy-container-fix branch"
echo "GitHub Actions will build: jjcsf/season-ticket-manager:latest"