#!/bin/bash

# Simple QNAP LXD Deployment for Season Ticket Manager
set -e

CONTAINER_NAME="season-ticket-manager-simple"
APP_PORT="5050"

echo "Deploying Season Ticket Manager to QNAP LXD..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./deploy-qnap-simple.sh"
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

# Setup port forwarding
echo "Setting up port forwarding..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT

# Install Node.js
echo "Installing Node.js..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq
    apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs
"

# Create application directory
echo "Setting up application..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    mkdir -p /opt/app
    useradd -r -s /bin/bash -d /opt/app appuser
    chown -R appuser:appuser /opt/app
"

# Copy the simple application
echo "Deploying application file..."
lxc file push qnap-simple-deploy.js "$CONTAINER_NAME/opt/app/server.js"
lxc exec "$CONTAINER_NAME" -- chown appuser:appuser /opt/app/server.js

# Create package.json
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/app/package.json << EOF
{
  "name": "season-ticket-manager",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF' appuser

# Install dependencies
echo "Installing dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/app && npm install --silent' appuser

# Create systemd service
echo "Creating service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=5050

[Install]
WantedBy=multi-user.target
EOF'

# Start service
echo "Starting application..."
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait and test
sleep 10

# Check if service is running
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "Service is running"
else
    echo "Service failed to start:"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
    exit 1
fi

# Test application
echo "Testing application..."
RESPONSE=$(lxc exec "$CONTAINER_NAME" -- curl -s http://localhost:5050/api/health || echo "failed")
if [[ "$RESPONSE" == *"ok"* ]]; then
    echo "Application is responding correctly"
else
    echo "Application test failed: $RESPONSE"
fi

# Get QNAP IP
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)

echo ""
echo "================================="
echo "DEPLOYMENT COMPLETE!"
echo "================================="
echo ""
echo "Application URL: http://$QNAP_IP:$APP_PORT"
echo "Health Check:    http://$QNAP_IP:$APP_PORT/api/health"
echo ""
echo "Features Available:"
echo "- Dashboard with financial overview"
echo "- Games scheduling and management" 
echo "- Ticket holder tracking"
echo "- Seat management system"
echo "- Real-time status monitoring"
echo ""
echo "Management Commands:"
echo "  Check status: lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "  View logs:    lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Restart:      lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo "  Stop:         lxc stop $CONTAINER_NAME"
echo "  Start:        lxc start $CONTAINER_NAME"
echo ""
echo "Your Season Ticket Manager is now accessible!"