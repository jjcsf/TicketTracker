#!/bin/bash

echo "Building Season Ticket Manager with Google Authentication..."

# Build the Docker image with Google auth
docker build -t jjcsf/season-ticket-manager:google-auth .

echo "Container built successfully!"
echo ""
echo "Next steps:"
echo "1. Set up Google OAuth credentials (see GOOGLE-AUTH-SETUP.md)"
echo "2. Update container-station-google-auth.yml with your Google credentials"
echo "3. Deploy to Container Station"
echo ""
echo "Your application will have:"
echo "- Secure Google OAuth login"
echo "- Protected dashboard and financial data"  
echo "- Session management with PostgreSQL storage"
echo "- All season ticket management features"