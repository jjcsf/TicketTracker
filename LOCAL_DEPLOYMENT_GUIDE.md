# Local QNAP Deployment Guide

## Upload Project to NAS

1. **Download project files** from Replit (or use existing files)
2. **Upload to NAS** via File Manager to: `/share/Container/projects/SeasonTicketTracker`
3. **Ensure these files are present:**
   - `package.json`
   - `Dockerfile.simple`
   - `container-interactive-server.js`
   - `client/` folder with React app
   - `server/` folder
   - `shared/` folder

## Create Container Application

Use this Docker Compose in Container Station:

```yaml
services:
  app:
    build:
      context: /share/Container/projects/SeasonTicketTracker
      dockerfile: Dockerfile.simple
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

## Benefits
- No Git dependency
- No network dependency during build
- Uses local files on your NAS
- Complete control over source code
- Fast deployment from local storage