#!/bin/bash

# Deploy Updated Season Ticket Manager to QNAP LXD
# This script deploys the working application with basic authentication

set -e

# Configuration
CONTAINER_NAME="season-ticket-manager-updated"
APP_PORT="5050"

echo "Deploying Updated Season Ticket Manager to QNAP LXD"
echo "================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./deploy-qnap-updated.sh"
    exit 1
fi

# Stop existing container if it exists
if lxc list | grep -q "$CONTAINER_NAME"; then
    echo "Stopping existing container..."
    lxc stop "$CONTAINER_NAME" --force 2>/dev/null || true
    lxc delete "$CONTAINER_NAME" --force 2>/dev/null || true
fi

# Launch container
echo "Creating Ubuntu 22.04 container..."
lxc launch ubuntu:22.04 "$CONTAINER_NAME"

# Wait for container
echo "Waiting for container to initialize..."
sleep 15

# Configure container
echo "Configuring container resources..."
lxc config set "$CONTAINER_NAME" limits.memory 2GB
lxc config set "$CONTAINER_NAME" limits.cpu 4

# Setup port forwarding
echo "Setting up port forwarding..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT

# Install Node.js and dependencies
echo "Installing Node.js and dependencies..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq
    apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential curl postgresql-client
"

# Create application directory
echo "Setting up application structure..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    mkdir -p /opt/season-ticket-manager
    useradd -r -s /bin/bash -d /opt/season-ticket-manager ticketmgr
    chown -R ticketmgr:ticketmgr /opt/season-ticket-manager
"

# Build and transfer the application
echo "Building application..."
npm run build

# Create the production bundle
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server-production.js

# Copy package.json and install dependencies in container
lxc file push package.json "$CONTAINER_NAME/opt/season-ticket-manager/"
lxc file push package-lock.json "$CONTAINER_NAME/opt/season-ticket-manager/"

# Install production dependencies
echo "Installing application dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c '
    cd /opt/season-ticket-manager
    npm install --production --silent
' ticketmgr

# Copy application files
echo "Transferring application files..."
lxc file push dist/server-production.js "$CONTAINER_NAME/opt/season-ticket-manager/server.js"
lxc file push -r shared "$CONTAINER_NAME/opt/season-ticket-manager/"
lxc file push -r client/dist "$CONTAINER_NAME/opt/season-ticket-manager/client-dist"

# Set ownership
lxc exec "$CONTAINER_NAME" -- chown -R ticketmgr:ticketmgr /opt/season-ticket-manager

# Create environment file
echo "Creating environment configuration..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/.env << EOF
NODE_ENV=production
PORT=5050
SESSION_SECRET=qnap-session-secret-2025-updated
DATABASE_URL=postgresql://username:password@localhost:5432/season_tickets
EOF' ticketmgr

# Create systemd service
echo "Creating systemd service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager - Updated
After=network.target

[Service]
Type=simple
User=ticketmgr
WorkingDirectory=/opt/season-ticket-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050
EnvironmentFile=/opt/season-ticket-manager/.env

[Install]
WantedBy=multi-user.target
EOF'

# Enable and start service
echo "Starting application service..."
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait for service to start
sleep 10

# Check service status
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "Service is running successfully"
else
    echo "Service failed to start. Checking logs..."
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20
    exit 1
fi

# Test the application
echo "Testing application endpoints..."
sleep 5

# Test health endpoint
HEALTH_CHECK=$(lxc exec "$CONTAINER_NAME" -- curl -s http://localhost:5050/api/health || echo "failed")
if [[ "$HEALTH_CHECK" == *"ok"* ]]; then
    echo "Health check passed"
else
    echo "Health check failed: $HEALTH_CHECK"
fi

# Get QNAP IP
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)

echo ""
echo "========================================="
echo "DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Application URL: http://$QNAP_IP:$APP_PORT"
echo "Health Check:    http://$QNAP_IP:$APP_PORT/api/health"
echo ""
echo "Features Available:"
echo "- Dashboard with financial analytics"
echo "- Games management and scheduling"
echo "- Ticket holder management"
echo "- Seat ownership tracking"
echo "- Payment and transfer handling"
echo "- Real-time reporting"
echo ""
echo "Management Commands:"
echo "  View logs:     lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Service status: lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "  Shell access:  lxc exec $CONTAINER_NAME -- bash"
echo "  Restart:       lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo "  Stop container: lxc stop $CONTAINER_NAME"
echo "  Start container: lxc start $CONTAINER_NAME"
echo ""
echo "To configure database connection:"
echo "  1. Edit: lxc exec $CONTAINER_NAME -- nano /opt/season-ticket-manager/.env"
echo "  2. Update DATABASE_URL with your PostgreSQL connection details"
echo "  3. Restart: lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo ""
echo "Your Season Ticket Manager is now running on QNAP LXD!"