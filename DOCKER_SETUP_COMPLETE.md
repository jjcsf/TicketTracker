# Complete Docker Setup Process

## Issue
The GitHub Actions workflow needs your Docker Hub credentials to publish the image.

## Required Setup Steps

### 1. Add Docker Hub Credentials to GitHub
1. Go to: https://github.com/jjcsf/TicketTracker/settings/secrets/actions
2. Click "New repository secret"
3. Add these two secrets:
   - Name: `DOCKER_USERNAME`, Value: `jjcsf`
   - Name: `DOCKER_PASSWORD`, Value: [Your Docker Hub password/token]

### 2. Trigger the Build
After adding secrets, you can:
- Push new code using Version Control tab, OR
- Go to https://github.com/jjcsf/TicketTracker/actions and manually run the workflow

### 3. Monitor Build Progress
- Check: https://github.com/jjcsf/TicketTracker/actions
- Build takes 5-10 minutes
- Success creates `jjcsf/season-ticket-manager:latest` on Docker Hub

### 4. Use in Container Station
Once published, use this exact Docker Compose:

```yaml
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

The workflow cannot publish without Docker Hub authentication credentials.