#!/bin/bash

set -e

echo "Verifying Full Season Ticket Manager Deployment"
echo "==============================================="

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Wait for container to be ready
echo "Waiting for container to complete initialization..."
sleep 30

# Check container status
echo "Checking container status..."
if ! lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    echo "Container is not running. Checking status:"
    lxc list "$CONTAINER_NAME"
    exit 1
fi

# Wait for services to be ready
echo "Waiting for services to initialize..."
sleep 15

# Check PostgreSQL
echo "Verifying PostgreSQL..."
if ! lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet postgresql; then
    echo "Starting PostgreSQL..."
    lxc exec "$CONTAINER_NAME" -- systemctl start postgresql
    sleep 10
fi

# Check if database exists
echo "Checking database..."
DB_EXISTS=$(lxc exec "$CONTAINER_NAME" -- su - postgres -c "psql -lqt | cut -d \| -f 1 | grep -w seasontickets | wc -l")
if [ "$DB_EXISTS" -eq "0" ]; then
    echo "Creating database..."
    lxc exec "$CONTAINER_NAME" -- su - postgres -c "createdb seasontickets"
    lxc exec "$CONTAINER_NAME" -- su - postgres -c "psql -c \"CREATE USER IF NOT EXISTS ticketmgr WITH PASSWORD 'ticketpass123';\""
    lxc exec "$CONTAINER_NAME" -- su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE seasontickets TO ticketmgr;\""
fi

# Check application service
echo "Checking Season Ticket Manager service..."
if ! lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "Starting Season Ticket Manager service..."
    lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager
    sleep 10
fi

# Test application
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:$APP_PORT"

echo "Testing application at $APP_URL..."
for i in {1..10}; do
    HEALTH_RESPONSE=$(curl -s "$APP_URL/api/health" 2>/dev/null || echo "FAILED")
    if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
        echo "✓ Application is responding"
        break
    else
        echo "Attempt $i: Waiting for application..."
        sleep 5
    fi
done

# Test API endpoints
echo "Testing API endpoints..."
curl -s "$APP_URL/api/teams" > /dev/null && echo "✓ Teams API working" || echo "✗ Teams API failed"
curl -s "$APP_URL/api/seasons" > /dev/null && echo "✓ Seasons API working" || echo "✗ Seasons API failed"
curl -s "$APP_URL/api/seats" > /dev/null && echo "✓ Seats API working" || echo "✗ Seats API failed"

# Show service logs if there are issues
echo "Recent service logs:"
lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10

echo ""
echo "Deployment verification complete!"
echo "Application URL: $APP_URL"
echo ""
echo "To access your Season Ticket Manager:"
echo "1. Open browser to $APP_URL"
echo "2. Create an account or login"
echo "3. Explore all features: Teams, Seasons, Seats, Payments, etc."