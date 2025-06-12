# Option 1: Pre-built Image Deployment

## Step 1: Create New Application in Container Station
1. Open Container Station on your NAS
2. Click "Create" → "Create Application"
3. Choose "Create Application" (not from template)

## Step 2: Configure Application
- **Application Name**: `season-ticket-manager`
- **Source**: Choose "Compose File"

## Step 3: Paste Docker Compose Content
Copy and paste this exact content:

```yaml
version: '3.8'

services:
  season-ticket-app:
    image: jjcsf/season-ticket-manager:latest
    ports:
      - "5050:5050"
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
```

## Step 4: Deploy
1. Click "Create" 
2. Wait for Container Station to pull the pre-built image
3. Both containers (app + postgres) should start automatically

## Step 5: Access Application
Navigate to: `http://your-nas-ip:5050`

## What You Get
- Complete React dashboard with 6 feature cards
- Authentication automatically bypassed
- Database with 49ers season ticket data
- Interactive navigation and forms
- No build time - uses pre-built image

The pre-built image contains everything compiled and ready to run.