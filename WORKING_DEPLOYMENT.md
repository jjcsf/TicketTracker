# Working Container Station Deployment

## Updated Docker Compose (Builds from GitHub)
Use this Docker Compose content instead:

```yaml
version: '3.8'

services:
  season-ticket-app:
    build:
      context: https://github.com/jjcsf/TicketTracker.git
      dockerfile: Dockerfile.prebuilt
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

## Deployment Steps
1. First publish your latest code using Replit's Version Control tab
2. Create new Container Station application
3. Use the compose content above
4. Container Station will build directly from GitHub
5. Access at `http://your-nas-ip:5050`

This builds the optimized container from your repository instead of using a non-existent pre-built image.