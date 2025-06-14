#!/bin/bash

echo "Season Ticket Manager - Connection Troubleshooting"
echo "================================================="

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Get network information
echo "Network Information:"
echo "==================="
QNAP_IP=$(hostname -I | awk '{print $1}')
echo "QNAP IP Address: $QNAP_IP"
echo "Application Port: $APP_PORT"
echo "Expected URL: http://$QNAP_IP:$APP_PORT"

echo ""
echo "Container Status:"
echo "================"
lxc list "$CONTAINER_NAME"

echo ""
echo "Port Forwarding Configuration:"
echo "============================="
lxc config device show "$CONTAINER_NAME" web 2>/dev/null || echo "No port forwarding device found"

echo ""
echo "Network Ports Status:"
echo "===================="
echo "Checking port $APP_PORT..."
netstat -tlnp | grep ":$APP_PORT" || echo "Port $APP_PORT not listening externally"

echo ""
echo "Container Internal Port Check:"
echo "============================="
lxc exec "$CONTAINER_NAME" -- netstat -tlnp | grep ":$APP_PORT" || echo "Application not listening on port $APP_PORT inside container"

echo ""
echo "Application Service Status:"
echo "=========================="
lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager

echo ""
echo "Testing Internal Connection:"
echo "==========================="
lxc exec "$CONTAINER_NAME" -- curl -s -m 5 http://localhost:$APP_PORT/api/health || echo "Internal connection failed"

echo ""
echo "Testing External Connection:"
echo "=========================="
curl -s -m 5 "http://$QNAP_IP:$APP_PORT/api/health" || echo "External connection failed"

echo ""
echo "Firewall Status:"
echo "==============="
iptables -L INPUT | grep -E "(ACCEPT|DROP|REJECT).*$APP_PORT" || echo "No specific firewall rules for port $APP_PORT"

echo ""
echo "Container Process Status:"
echo "======================="
lxc exec "$CONTAINER_NAME" -- ps aux | grep node || echo "No Node.js processes found"

echo ""
echo "Recent Application Logs:"
echo "======================"
lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20

echo ""
echo "TROUBLESHOOTING RECOMMENDATIONS:"
echo "==============================="
echo "1. If port forwarding is missing, run:"
echo "   lxc config device add $CONTAINER_NAME web proxy listen=tcp:0.0.0.0:$APP_PORT connect=tcp:127.0.0.1:$APP_PORT"
echo ""
echo "2. If service is not running, restart it:"
echo "   lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo ""
echo "3. If firewall is blocking, allow the port:"
echo "   iptables -A INPUT -p tcp --dport $APP_PORT -j ACCEPT"
echo ""
echo "4. Try accessing from QNAP locally first:"
echo "   curl http://localhost:$APP_PORT"
echo ""
echo "5. Check if you can access from same network:"
echo "   http://$QNAP_IP:$APP_PORT"