#!/bin/bash

<<<<<<< HEAD
# Git-based update script for Container Station deployment
# Place this script in your container and run to update from git repository

set -e

echo "Starting git update process..."

# Configuration
REPO_URL="https://github.com/your-username/ticket-management.git"  # Update with your repo
PROJECT_DIR="/app"
BACKUP_DIR="/app-backup-$(date +%Y%m%d-%H%M%S)"
CONTAINER_NAME="ticket-management_app_1"  # Update with your container name

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Create backup of current application
log "Creating backup of current application..."
cp -r $PROJECT_DIR $BACKUP_DIR

# Pull latest changes from git
log "Pulling latest changes from repository..."
cd $PROJECT_DIR

# Initialize git if not already done
if [ ! -d ".git" ]; then
    log "Initializing git repository..."
    git init
    git remote add origin $REPO_URL
fi

# Fetch and reset to latest
git fetch origin main
git reset --hard origin/main

# Rebuild frontend
log "Rebuilding frontend..."
npm ci
npm run build

# Restart the application service
log "Restarting application..."
# For container restart
if command -v docker &> /dev/null; then
    docker restart $CONTAINER_NAME
else
    # For PM2 or direct restart
    pkill -f "node server/start.js" || true
    sleep 2
    nohup node server/start.js > /dev/null 2>&1 &
fi

log "Update completed successfully!"
log "Backup saved at: $BACKUP_DIR"
=======
# Script to update Container Station from Git repository
echo "Setting up Git-based container updates..."

# Create update script for your NAS
cat > container-git-update.sh << 'EOF'
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
EOF

echo "Created container-git-update.sh"
echo "Upload this script to your NAS and run it to update from Git"

# Also create a webhook script for automatic updates
cat > webhook-update.sh << 'EOF'
#!/bin/bash

# Webhook script for automatic updates
# Place this in your NAS web server directory

cd /share/Container/projects/SeasonTicketTracker
git pull origin main
docker-compose up -d --build
EOF

echo "Created webhook-update.sh for automatic updates"
>>>>>>> 21aa58d (Initial commit)
