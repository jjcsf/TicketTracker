# Automatic Docker Publishing with GitHub Actions

## Setup Required

1. **Add Docker Hub Secrets to GitHub Repository**:
   - Go to your GitHub repository: https://github.com/jjcsf/TicketTracker
   - Navigate to Settings → Secrets and Variables → Actions
   - Add these secrets:
     - `DOCKER_USERNAME`: `jjcsf`
     - `DOCKER_PASSWORD`: Your Docker Hub password/token

2. **Push Code to Trigger Build**:
   - Use Replit's Version Control tab to commit and push
   - GitHub Actions will automatically build and publish `jjcsf/season-ticket-manager:latest`

## After Publishing

Use this Docker Compose in Container Station:

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

The workflow builds using `Dockerfile.simple` and publishes to Docker Hub automatically.