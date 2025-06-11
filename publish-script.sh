#!/bin/bash

# Script to publish complete project to GitHub
echo "Publishing Season Ticket Tracker to GitHub..."

# Set Git configuration
git config --global user.email "action@github.com"
git config --global user.name "GitHub Action"

# Add all files
git add -A

# Create commit
git commit -m "Complete season ticket management application with React frontend, Express backend, and PostgreSQL database"

# Force push to overcome conflicts
git push --force-with-lease origin main

echo "Project published successfully!"