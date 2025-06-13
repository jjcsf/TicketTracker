#!/bin/bash

echo "Monitoring Season Ticket Manager Deployment"
echo "==========================================="

CONTAINER_NAME="season-ticket-manager"

# Check if container exists
if ! lxc list | grep -q "$CONTAINER_NAME"; then
    echo "Container $CONTAINER_NAME not found. Please run the deployment script first."
    exit 1
fi

echo "Container Status:"
lxc list "$CONTAINER_NAME"

echo ""
echo "Container Resource Usage:"
lxc info "$CONTAINER_NAME"

echo ""
echo "Checking PostgreSQL status..."
lxc exec "$CONTAINER_NAME" -- systemctl status postgresql --no-pager -l

echo ""
echo "Checking Season Ticket Manager service status..."
lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager -l

echo ""
echo "Recent application logs:"
lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20

echo ""
echo "Testing application endpoints..."
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:5050"

echo "Health check: $APP_URL/api/health"
curl -s "$APP_URL/api/health" | head -5

echo ""
echo "Testing database connection..."
lxc exec "$CONTAINER_NAME" -- su - ticketmgr -c "cd /opt/season-ticket-manager && node -e \"
const { pool } = require('./schema');
pool.query('SELECT COUNT(*) FROM users').then(result => {
  console.log('Database connection: OK');
  console.log('Users in database:', result.rows[0].count);
  process.exit(0);
}).catch(error => {
  console.error('Database error:', error.message);
  process.exit(1);
});
\""

echo ""
echo "Application should be available at: $APP_URL"