#!/bin/bash

# Complete deployment script for Container Station
echo "Creating complete deployment package..."

# Create deployment directory
mkdir -p deployment-package

# Copy all essential files
cp -r client/ deployment-package/
cp -r server/ deployment-package/
cp -r shared/ deployment-package/
cp package.json deployment-package/
cp package-lock.json deployment-package/
cp vite.config.ts deployment-package/
cp tailwind.config.ts deployment-package/
cp tsconfig.json deployment-package/
cp Dockerfile deployment-package/
cp docker-compose.yml deployment-package/
cp drizzle.config.ts deployment-package/
cp postcss.config.js deployment-package/
cp components.json deployment-package/

# Create README for deployment
cat > deployment-package/README.md << 'EOF'
# Season Ticket Management System

Complete React application with Express backend and PostgreSQL database.

## Container Station Deployment

1. Upload this entire folder to `/share/Container/projects/SeasonTicketTracker`
2. In Container Station: Applications → Create → Docker Compose
3. Select the project folder and deploy
4. Access at http://your-nas-ip:5050

## Features

- Complete dashboard with 49ers team data
- Financial analytics and reporting
- Seat ownership management
- Game attendance tracking
- Ticket transfer system
- Payout calculations

Login with email matching ticket holder database.
EOF

echo "Deployment package created in deployment-package/ directory"
echo "Ready for Container Station deployment"