#!/bin/bash

# Season Ticket Manager - Container Deployment Script
# This script builds and runs the Season Ticket Manager application in Docker

set -e  # Exit on any error

echo "🎫 Season Ticket Manager - Container Deployment"
echo "================================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://postgres:ticketpass123@postgres:5432/ticket_management

# Authentication Configuration (REQUIRED - Update these values)
SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "CHANGE-THIS-TO-SECURE-RANDOM-STRING")
REPLIT_DOMAINS=localhost:5050,your-production-domain.com
REPL_ID=your-repl-id-from-replit
ISSUER_URL=https://replit.com/oidc

# Application Configuration
NODE_ENV=production
PORT=5050

# PostgreSQL Configuration
POSTGRES_DB=ticket_management
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ticketpass123
EOF
    echo "⚠️  IMPORTANT: Edit the .env file and update:"
    echo "   - REPL_ID: Get this from your Replit account"
    echo "   - REPLIT_DOMAINS: Add your actual domain(s)"
    echo "   - SESSION_SECRET: Generated automatically (keep secure)"
    echo ""
    echo "Press Enter after updating .env file to continue..."
    read
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
$COMPOSE_CMD down 2>/dev/null || true

# Build and start the application
echo "🔨 Building Season Ticket Manager..."
$COMPOSE_CMD build --no-cache

echo "🚀 Starting Season Ticket Manager..."
$COMPOSE_CMD up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if $COMPOSE_CMD ps | grep -q "Up"; then
    echo "✅ Season Ticket Manager is running!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   • Main App: http://localhost:5050"
    echo "   • Login: http://localhost:5050/api/login"
    echo "   • Logout: http://localhost:5050/api/logout"
    echo ""
    echo "📊 Database:"
    echo "   • PostgreSQL: localhost:5432"
    echo "   • Database: ticket_management"
    echo "   • User: postgres"
    echo ""
    echo "🔧 Management Commands:"
    echo "   • View logs: $COMPOSE_CMD logs -f"
    echo "   • Stop app: $COMPOSE_CMD down"
    echo "   • Restart: $COMPOSE_CMD restart"
    echo "   • View status: $COMPOSE_CMD ps"
else
    echo "❌ Failed to start services. Checking logs..."
    $COMPOSE_CMD logs --tail=20
    exit 1
fi

echo ""
echo "🎉 Deployment complete! The Season Ticket Manager is ready to use."
EOF

chmod +x deploy.sh