#!/bin/bash

echo "Quick Season Ticket Manager Deployment Test"
echo "==========================================="

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Get QNAP IP
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:$APP_PORT"

echo "Testing access to: $APP_URL"
echo ""

# Check if container exists
if lxc list 2>/dev/null | grep -q "$CONTAINER_NAME"; then
    echo "✓ Container exists"
    
    # Check if running
    if lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
        echo "✓ Container is running"
        
        # Test application
        echo "Testing application..."
        RESPONSE=$(curl -s -m 5 "$APP_URL" 2>/dev/null | head -1)
        if [[ "$RESPONSE" == *"DOCTYPE"* ]] || [[ "$RESPONSE" == *"html"* ]]; then
            echo "✓ Application is responding!"
            echo ""
            echo "🎉 SUCCESS! Your Season Ticket Manager is available at:"
            echo "   $APP_URL"
            echo ""
            echo "Open this URL in your browser to access the application."
        else
            echo "✗ Application not responding properly"
            echo "Response: $RESPONSE"
            
            # Check service status
            echo ""
            echo "Checking service status..."
            lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager -l
        fi
    else
        echo "✗ Container not running - starting it..."
        lxc start "$CONTAINER_NAME"
        sleep 10
        echo "Container started. Testing again in 15 seconds..."
        sleep 15
        exec "$0"
    fi
else
    echo "✗ Container does not exist"
    echo ""
    echo "To deploy the Season Ticket Manager:"
    echo "1. Make sure you're on your QNAP"
    echo "2. Run: sudo ./deploy-complete-qnap.sh"
    echo ""
    echo "Available scripts:"
    ls -la deploy-*.sh 2>/dev/null
fi

echo ""
echo "Your QNAP IP: $QNAP_IP"
echo "Expected URL: $APP_URL"
echo ""
echo "If you can access this URL, the deployment was successful!"