#!/bin/bash

# Git pull script for updating the repository
echo "Attempting to pull latest changes from Git repository..."

# Remove any lock files if they exist
if [ -f .git/index.lock ]; then
    echo "Removing Git lock file..."
    rm -f .git/index.lock
fi

# Check current branch
echo "Current branch:"
git branch --show-current

# Fetch latest changes
echo "Fetching latest changes..."
git fetch origin

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Show status
echo "Repository status:"
git status --short

echo "Git pull completed successfully!"