#!/bin/bash

# Season Ticket Manager - QNAP Deployment Test Script
# Run this script to test your deployed application

set -e

# Configuration
CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Get QNAP IP
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:$APP_PORT"

echo "Season Ticket Manager - Deployment Test"
echo "======================================"
echo "QNAP IP: $QNAP_IP"
echo "App URL: $APP_URL"
echo ""

# Test 1: Container Status
print_test "Checking container status..."
if lxc list | grep -q "$CONTAINER_NAME.*RUNNING"; then
    print_success "Container is running"
else
    print_error "Container is not running"
    echo "Available containers:"
    lxc list
    exit 1
fi

# Test 2: Service Status
print_test "Checking application service..."
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    print_success "Application service is active"
else
    print_error "Application service is not running"
    echo "Service logs:"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
    exit 1
fi

# Test 3: Port Binding
print_test "Checking port binding..."
if lxc exec "$CONTAINER_NAME" -- netstat -tulpn | grep -q ":5050"; then
    print_success "Application is listening on port 5050"
else
    print_error "Port 5050 is not bound"
    echo "Active ports in container:"
    lxc exec "$CONTAINER_NAME" -- netstat -tulpn
fi

# Test 4: Health Check
print_test "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s "$APP_URL/api/health" 2>/dev/null || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    print_success "Health check passed"
    echo "Health response: $HEALTH_RESPONSE"
else
    print_error "Health check failed"
    echo "Response: $HEALTH_RESPONSE"
fi

# Test 5: Web Interface
print_test "Testing web interface..."
WEB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null || echo "000")
if [[ "$WEB_RESPONSE" == "200" ]]; then
    print_success "Web interface is accessible"
else
    print_error "Web interface returned status: $WEB_RESPONSE"
fi

# Test 6: Authentication Endpoints
print_test "Testing authentication endpoints..."
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL/api/auth/user" 2>/dev/null || echo "000")
if [[ "$AUTH_RESPONSE" == "401" ]]; then
    print_success "Authentication endpoint working (expected 401 for unauthenticated)"
else
    print_error "Authentication endpoint returned unexpected status: $AUTH_RESPONSE"
fi

echo ""
echo "Test Summary"
echo "============"
print_info "Application URL: $APP_URL"
print_info "Health Check: $APP_URL/api/health"
print_info "Project Path: /share/Container/projects/SeasonTicketTracker"

echo ""
echo "Manual Testing Steps:"
echo "1. Open browser and visit: $APP_URL"
echo "2. Try creating an account"
echo "3. Test login functionality"
echo "4. Verify dashboard loads"

echo ""
echo "Container Management:"
echo "  View logs:    lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Restart app:  lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo "  Container shell: lxc exec $CONTAINER_NAME -- bash"
echo "  Stop container:  lxc stop $CONTAINER_NAME"
echo "  Start container: lxc start $CONTAINER_NAME"

echo ""
print_success "Deployment test completed!"