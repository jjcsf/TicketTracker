#!/bin/bash

echo "Checking QNAP Season Ticket Manager Deployment Status"
echo "===================================================="

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Check if container exists and is running
if lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    echo "✓ Container is running"
    
    # Get QNAP IP address
    QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
    APP_URL="http://$QNAP_IP:$APP_PORT"
    
    echo "Container Status:"
    lxc list "$CONTAINER_NAME"
    
    echo ""
    echo "Checking services..."
    
    # Check PostgreSQL
    if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet postgresql 2>/dev/null; then
        echo "✓ PostgreSQL is running"
    else
        echo "✗ PostgreSQL is not running"
        echo "Starting PostgreSQL..."
        lxc exec "$CONTAINER_NAME" -- systemctl start postgresql
        sleep 5
    fi
    
    # Check Season Ticket Manager service
    if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager 2>/dev/null; then
        echo "✓ Season Ticket Manager service is running"
    else
        echo "✗ Season Ticket Manager service is not running"
        echo "Starting Season Ticket Manager..."
        lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager
        sleep 10
    fi
    
    echo ""
    echo "Testing application endpoints..."
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s -m 10 "$APP_URL/api/health" 2>/dev/null || echo "FAILED")
    if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
        echo "✓ Health endpoint working: $APP_URL/api/health"
    else
        echo "✗ Health endpoint failed"
        echo "Response: $HEALTH_RESPONSE"
    fi
    
    # Test main page
    MAIN_RESPONSE=$(curl -s -m 10 "$APP_URL/" 2>/dev/null | head -1)
    if [[ "$MAIN_RESPONSE" == *"DOCTYPE"* ]] || [[ "$MAIN_RESPONSE" == *"html"* ]]; then
        echo "✓ Main page working: $APP_URL"
    else
        echo "✗ Main page failed"
        echo "Response: $MAIN_RESPONSE"
    fi
    
    echo ""
    echo "Port forwarding status:"
    lxc config device show "$CONTAINER_NAME"
    
    echo ""
    echo "Recent application logs:"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
    
    echo ""
    echo "=============================================="
    echo "ACCESS YOUR SEASON TICKET MANAGER:"
    echo "=============================================="
    echo "Main Application: $APP_URL"
    echo "Health Check: $APP_URL/api/health"
    echo "=============================================="
    echo ""
    echo "If you can't access the application:"
    echo "1. Check firewall: sudo iptables -L | grep $APP_PORT"
    echo "2. Test locally: curl $APP_URL/api/health"
    echo "3. Check logs: lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
    
elif lxc list | grep -q "$CONTAINER_NAME"; then
    echo "⚠ Container exists but is not running"
    echo "Starting container..."
    lxc start "$CONTAINER_NAME"
    sleep 10
    echo "Container started. Waiting for services..."
    sleep 15
    
    # Retry the check
    exec "$0"
else
    echo "⚠ Container '$CONTAINER_NAME' does not exist"
    echo ""
    echo "To deploy the complete Season Ticket Manager:"
    echo "  sudo ./deploy-complete-qnap.sh"
    echo ""
    echo "Available deployment scripts:"
    ls -la deploy-*.sh 2>/dev/null || echo "No deployment scripts found"
fi

echo ""
echo "Current LXD containers:"
lxc list