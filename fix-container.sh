#!/bin/bash

set -e

# Configuration
CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "Season Ticket Manager - Container Fix"
echo "===================================="

# Check if container exists and is running
if ! lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    print_error "Container not running. Starting container first..."
    lxc start "$CONTAINER_NAME" 2>/dev/null || true
    sleep 5
fi

# Check service logs first
print_step "Checking service logs..."
lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20

print_step "Checking application directory..."
lxc exec "$CONTAINER_NAME" -- ls -la /opt/season-ticket-manager/

print_step "Testing Node.js in container..."
lxc exec "$CONTAINER_NAME" -- node --version

print_step "Checking if server.js exists and is readable..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat /opt/season-ticket-manager/server.js | head -10' ticketmgr

print_step "Testing manual server start..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && timeout 5s node server.js || echo "Manual test completed"' ticketmgr

print_step "Recreating and starting service..."

# Stop service
lxc exec "$CONTAINER_NAME" -- systemctl stop season-ticket-manager 2>/dev/null || true

# Recreate service file with better configuration
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager Application
After=network.target
Wants=network.target

[Service]
Type=simple
User=ticketmgr
Group=ticketmgr
WorkingDirectory=/opt/season-ticket-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050
StandardOutput=journal
StandardError=journal
SyslogIdentifier=season-ticket-manager

[Install]
WantedBy=multi-user.target
EOF'

# Reload systemd
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload

# Enable and start service
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait and check status
sleep 3

if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    print_success "Service is now running!"
else
    print_error "Service still not starting. Checking logs again..."
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
    
    print_step "Trying alternative startup method..."
    # Try starting manually in background
    lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && nohup node server.js > server.log 2>&1 &' ticketmgr
    sleep 3
    
    # Check if process is running
    if lxc exec "$CONTAINER_NAME" -- pgrep -f "node server.js" > /dev/null; then
        print_success "Application started manually"
    else
        print_error "Failed to start application"
        exit 1
    fi
fi

# Test the application
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:$APP_PORT"

print_step "Testing application..."
sleep 2

HEALTH_RESPONSE=$(curl -s "$APP_URL/api/health" 2>/dev/null || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    print_success "Application is responding!"
    echo "Health check: $HEALTH_RESPONSE"
else
    print_error "Application not responding. Checking port binding..."
    lxc exec "$CONTAINER_NAME" -- netstat -tulpn | grep 5050 || echo "Port 5050 not bound"
fi

echo ""
print_success "Fix attempt completed!"
echo "Application URL: $APP_URL"
echo "View logs: lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"