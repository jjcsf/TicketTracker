#!/bin/bash

# Deploy Season Ticket Manager to GitHub
echo "🚀 Deploying Season Ticket Manager to GitHub..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository"
    exit 1
fi

# Add all files
git add .

# Create commit with deployment message
git commit -m "Container deployment ready - ES modules fixed

- Fixed ES module compatibility in container-interactive-server.js
- Updated Dockerfile.simple for container deployment
- Added GitHub Actions workflow for Docker publishing
- Enhanced authentication bypass for containers
- Complete PostgreSQL schema with sample data
- Docker Compose configurations for Container Station"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo "🔄 GitHub Actions will now build Docker image: jjcsf/season-ticket-manager:latest"
    echo "⏱️  Build time: ~5-10 minutes"
    echo "🔗 Monitor at: https://github.com/jjcsf/TicketTracker/actions"
else
    echo "❌ Failed to push to GitHub"
    echo "💡 Try manually uploading these key files to GitHub:"
    echo "   - container-interactive-server.js"
    echo "   - Dockerfile.simple" 
    echo "   - .github/workflows/docker-publish.yml"
    echo "   - docker-compose.published.yml"
fi