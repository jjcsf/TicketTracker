#!/bin/bash

echo "Fixing Season Ticket Manager Connection Issues"
echo "============================================="

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Get QNAP IP
QNAP_IP=$(hostname -I | awk '{print $1}')
echo "QNAP IP: $QNAP_IP"
echo "Target URL: http://$QNAP_IP:$APP_PORT"

# Fix 1: Ensure port forwarding is configured correctly
echo ""
echo "Step 1: Configuring port forwarding..."
lxc config device remove "$CONTAINER_NAME" web 2>/dev/null || true
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT
echo "✓ Port forwarding configured"

# Fix 2: Restart the application service
echo ""
echo "Step 2: Restarting application service..."
lxc exec "$CONTAINER_NAME" -- systemctl restart season-ticket-manager
sleep 10
echo "✓ Service restarted"

# Fix 3: Open firewall port
echo ""
echo "Step 3: Opening firewall port..."
iptables -C INPUT -p tcp --dport $APP_PORT -j ACCEPT 2>/dev/null || \
iptables -A INPUT -p tcp --dport $APP_PORT -j ACCEPT
echo "✓ Firewall port opened"

# Fix 4: Test connectivity
echo ""
echo "Step 4: Testing connectivity..."
sleep 5

# Test internal connection first
echo "Testing internal connection..."
INTERNAL_TEST=$(lxc exec "$CONTAINER_NAME" -- curl -s -m 5 http://localhost:$APP_PORT/api/health 2>/dev/null)
if [[ "$INTERNAL_TEST" == *"healthy"* ]]; then
    echo "✓ Internal connection working"
else
    echo "✗ Internal connection failed"
    echo "Checking service status..."
    lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager
    echo "Recent logs:"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
fi

# Test external connection
echo "Testing external connection..."
EXTERNAL_TEST=$(curl -s -m 5 "http://$QNAP_IP:$APP_PORT/api/health" 2>/dev/null)
if [[ "$EXTERNAL_TEST" == *"healthy"* ]]; then
    echo "✓ External connection working"
    echo ""
    echo "SUCCESS! Your Season Ticket Manager is now accessible at:"
    echo "http://$QNAP_IP:$APP_PORT"
    echo ""
    echo "Open this URL in your browser to access the application."
else
    echo "✗ External connection still failing"
    echo ""
    echo "Additional troubleshooting needed..."
    
    # Check if port is listening
    echo "Checking port status:"
    netstat -tlnp | grep ":$APP_PORT"
    
    echo ""
    echo "Container port forwarding:"
    lxc config device show "$CONTAINER_NAME"
fi

echo ""
echo "Connection fix attempt completed."