#!/bin/bash

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

echo "Immediate Season Ticket Manager Connection Fix"
echo "=============================================="

# Get network info
QNAP_IP=$(hostname -I | awk '{print $1}')
echo "QNAP IP: $QNAP_IP"

# Check container status
if ! lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    echo "Starting container..."
    lxc start "$CONTAINER_NAME"
    sleep 10
fi

# Remove and recreate port forwarding with correct binding
echo "Fixing port forwarding..."
lxc config device remove "$CONTAINER_NAME" web 2>/dev/null || true
sleep 2
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT \
    bind=host

# Ensure services are running
echo "Starting services..."
lxc exec "$CONTAINER_NAME" -- systemctl start postgresql
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager
sleep 15

# Open firewall
echo "Opening firewall..."
iptables -C INPUT -p tcp --dport $APP_PORT -j ACCEPT 2>/dev/null || \
iptables -I INPUT -p tcp --dport $APP_PORT -j ACCEPT

# Test connection
echo "Testing connection..."
for i in {1..10}; do
    RESPONSE=$(curl -s -m 3 "http://$QNAP_IP:$APP_PORT/api/health" 2>/dev/null)
    if [[ "$RESPONSE" == *"healthy"* ]]; then
        echo "SUCCESS! Application is now accessible at:"
        echo "http://$QNAP_IP:$APP_PORT"
        exit 0
    fi
    echo "Attempt $i/10..."
    sleep 3
done

echo "Still having issues. Checking detailed status..."
echo "Container status:"
lxc list "$CONTAINER_NAME"
echo "Port forwarding:"
lxc config device show "$CONTAINER_NAME"
echo "Service status:"
lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager -l
echo "Listening ports:"
netstat -tlnp | grep $APP_PORT