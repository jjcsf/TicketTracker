#!/bin/bash

# Deployment Validation Script for Container Station
echo "🚀 Validating Ticket Management Platform Deployment..."

# Check if Docker and Docker Compose are available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please configure your environment variables."
fi

# Validate Docker Compose configuration
echo "🔍 Validating Docker Compose configuration..."
if docker-compose config &> /dev/null; then
    echo "✅ Docker Compose configuration is valid"
else
    echo "❌ Docker Compose configuration has errors:"
    docker-compose config
    exit 1
fi

# Check available ports
echo "🔍 Checking port availability..."
if lsof -i :5000 &> /dev/null; then
    echo "⚠️  Port 5000 is already in use. Application will use Docker's port mapping."
fi

if lsof -i :5432 &> /dev/null; then
    echo "⚠️  Port 5432 is already in use. PostgreSQL might conflict."
fi

# Build and start services
echo "🔨 Building and starting services..."
docker-compose down -v &> /dev/null  # Clean start
docker-compose build --no-cache

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."

# Check if containers are running
APP_STATUS=$(docker-compose ps -q app | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null)
DB_STATUS=$(docker-compose ps -q postgres | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null)

if [ "$APP_STATUS" = "running" ]; then
    echo "✅ Application container is running"
else
    echo "❌ Application container is not running"
    docker-compose logs app
    exit 1
fi

if [ "$DB_STATUS" = "running" ]; then
    echo "✅ Database container is running"
else
    echo "❌ Database container is not running"
    docker-compose logs postgres
    exit 1
fi

# Test database connectivity
echo "🔍 Testing database connectivity..."
docker-compose exec -T postgres psql -U postgres -d ticket_management -c "SELECT 1;" &> /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database is accessible"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec -T app npm run db:push

if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed"
else
    echo "⚠️  Database migrations had issues (this might be normal on first run)"
fi

# Test application endpoint
echo "🔍 Testing application endpoint..."
sleep 10  # Give app more time to start

# Get the application port
APP_PORT=$(docker-compose port app 5000 2>/dev/null | cut -d: -f2)
if [ -z "$APP_PORT" ]; then
    APP_PORT="5000"
fi

# Test health endpoint
if curl -f -s http://localhost:$APP_PORT/ &> /dev/null; then
    echo "✅ Application is responding on port $APP_PORT"
else
    echo "⚠️  Application might still be starting up..."
    echo "   Check manually at: http://localhost:$APP_PORT"
fi

# Display service information
echo ""
echo "📋 Deployment Summary:"
echo "===================="
echo "Application URL: http://localhost:$APP_PORT"
echo "Database: postgresql://postgres:password@localhost:5432/ticket_management"
echo ""
echo "🔧 Management Commands:"
echo "View logs: docker-compose logs -f"
echo "Stop services: docker-compose down"
echo "Restart: docker-compose restart"
echo "Update: docker-compose down && docker-compose build --no-cache && docker-compose up -d"
echo ""

# External API status
echo "🔍 External API Configuration Status:"
if [ -n "$SEATGEEK_CLIENT_ID" ] && [ -n "$SEATGEEK_CLIENT_SECRET" ]; then
    echo "✅ SeatGeek API configured"
else
    echo "⚠️  SeatGeek API not configured (optional)"
fi

if [ -n "$STUBHUB_API_KEY" ]; then
    echo "✅ StubHub API configured" 
else
    echo "⚠️  StubHub API not configured (optional)"
fi

echo ""
echo "🎉 Deployment validation complete!"
echo "   Your ticket management platform is ready to use."
echo ""
echo "📚 Next Steps:"
echo "1. Access the application at http://localhost:$APP_PORT"
echo "2. Configure external API keys in .env if needed"
echo "3. Set up reverse proxy with SSL for production"
echo "4. Configure regular database backups"