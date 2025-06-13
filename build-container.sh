#!/bin/bash

# Simple Docker Build Script for Season Ticket Manager
# Use this if you prefer manual Docker commands over docker-compose

echo "Building Season Ticket Manager Container..."

# Build the Docker image
docker build -t season-ticket-manager .

echo "Container built successfully!"
echo ""
echo "To run the container:"
echo "docker run -d -p 5050:5050 --name season-ticket-manager \\"
echo "  -e DATABASE_URL='your-database-url' \\"
echo "  -e SESSION_SECRET='your-session-secret' \\"
echo "  -e REPLIT_DOMAINS='localhost:5050,your-domain.com' \\"
echo "  -e REPL_ID='your-repl-id' \\"
echo "  season-ticket-manager"
echo ""
echo "Or use the deploy.sh script for a complete setup with PostgreSQL."