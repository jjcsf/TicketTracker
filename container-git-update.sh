#!/bin/bash

# Update Container Station deployment from Git
echo "Updating Season Ticket Tracker from GitHub..."

# Navigate to projects directory
cd /share/Container/projects/

# Remove old version if it exists
if [ -d "SeasonTicketTracker" ]; then
    echo "Removing old deployment..."
    rm -rf SeasonTicketTracker
fi

# Clone fresh copy from GitHub
echo "Cloning latest version..."
git clone https://github.com/jjcsf/SeasonTicketTracker.git

# Navigate to project directory
cd SeasonTicketTracker

# Stop existing container
echo "Stopping existing container..."
docker-compose down 2>/dev/null || true

# Build and start updated container
echo "Starting updated container..."
docker-compose up -d --build

echo "Container updated successfully!"
echo "Access at: http://your-nas-ip:5050"
