#!/bin/bash

echo "Season Ticket Manager - Deployment Status Check"
echo "==============================================="

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Check if container exists and is running
if lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    echo "✓ Container is running"
    
    # Check if PostgreSQL is installed and running
    if lxc exec "$CONTAINER_NAME" -- which psql >/dev/null 2>&1; then
        echo "✓ PostgreSQL is installed"
        
        if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet postgresql 2>/dev/null; then
            echo "✓ PostgreSQL service is running"
        else
            echo "⚠ PostgreSQL service not running - starting it..."
            lxc exec "$CONTAINER_NAME" -- systemctl start postgresql
        fi
    else
        echo "⚠ PostgreSQL not yet installed - deployment still in progress"
    fi
    
    # Check if Node.js is installed
    if lxc exec "$CONTAINER_NAME" -- which node >/dev/null 2>&1; then
        echo "✓ Node.js is installed"
        NODE_VERSION=$(lxc exec "$CONTAINER_NAME" -- node --version)
        echo "  Version: $NODE_VERSION"
    else
        echo "⚠ Node.js not yet installed - deployment still in progress"
    fi
    
    # Check if application files exist
    if lxc exec "$CONTAINER_NAME" -- test -f /opt/season-ticket-manager/server.js; then
        echo "✓ Application files deployed"
        
        # Check if service is running
        if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager 2>/dev/null; then
            echo "✓ Season Ticket Manager service is running"
            
            # Test application
            QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
            APP_URL="http://$QNAP_IP:$APP_PORT"
            
            HEALTH_RESPONSE=$(curl -s -m 5 "$APP_URL/api/health" 2>/dev/null || echo "TIMEOUT")
            if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
                echo "✓ Application is responding at $APP_URL"
                echo ""
                echo "🎉 DEPLOYMENT COMPLETE!"
                echo "Access your Season Ticket Manager at: $APP_URL"
            else
                echo "⚠ Application not responding - checking logs..."
                lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 5
            fi
        else
            echo "⚠ Season Ticket Manager service not running"
        fi
    else
        echo "⚠ Application files not yet deployed - deployment still in progress"
    fi
    
    echo ""
    echo "Container resource usage:"
    lxc exec "$CONTAINER_NAME" -- free -h
    lxc exec "$CONTAINER_NAME" -- df -h /
    
elif lxc list | grep -q "$CONTAINER_NAME"; then
    echo "⚠ Container exists but is not running"
    lxc list "$CONTAINER_NAME"
else
    echo "⚠ Container does not exist - please run the deployment script"
fi

echo ""
echo "To monitor deployment progress in real-time:"
echo "  ./monitor-deployment.sh"
echo ""
echo "To verify full deployment:"
echo "  ./verify-full-deployment.sh"