#!/bin/bash

# Create complete application package for Container Station
echo "Creating complete application package..."

# Create temporary directory
mkdir -p complete-app-package

# Copy all essential application files
cp -r client/ complete-app-package/
cp -r server/ complete-app-package/
cp -r shared/ complete-app-package/
cp package.json complete-app-package/
cp package-lock.json complete-app-package/
cp vite.config.ts complete-app-package/
cp tailwind.config.ts complete-app-package/
cp tsconfig.json complete-app-package/
cp Dockerfile complete-app-package/
cp docker-compose.yml complete-app-package/
cp drizzle.config.ts complete-app-package/
cp postcss.config.js complete-app-package/
cp components.json complete-app-package/

# Create new docker-compose that builds locally
cat > complete-app-package/docker-compose.yml << 'EOF'
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5050:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:ticketpass123@postgres:5432/ticket_management
      - PGDATABASE=ticket_management
      - PGUSER=postgres
      - PGPASSWORD=ticketpass123
      - PGHOST=postgres
      - PGPORT=5432
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=ticket_management
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=ticketpass123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
EOF

# Create deployment instructions
cat > complete-app-package/DEPLOY.md << 'EOF'
# Container Station Deployment

## Upload Instructions
1. Download this complete-app-package folder
2. Upload entire folder to `/share/Container/projects/SeasonTicketTracker`
3. Replace existing files completely

## Deploy Commands
SSH to your NAS and run:

```bash
cd /share/Container/projects/SeasonTicketTracker
docker-compose down
docker-compose up -d --build
```

## Result
- Complete React dashboard with navigation menu
- 49ers team data loaded
- Financial analytics working
- All ticket management features active
EOF

echo "Complete application package created!"
echo "Upload complete-app-package/ to your Container Station"