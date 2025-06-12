# Publish to Docker Repository

## Method 1: Using Build Script

1. **Update the username** in `docker-publish.sh`:
   ```bash
   DOCKER_USERNAME="your-actual-docker-username"
   ```

2. **Run the publish script**:
   ```bash
   chmod +x docker-publish.sh
   ./docker-publish.sh
   ```

## Method 2: Manual Commands

```bash
# Build the image
docker build -f Dockerfile.simple -t your-username/season-ticket-manager:latest .

# Login to Docker Hub
docker login

# Push to repository
docker push your-username/season-ticket-manager:latest
```

## Using Published Image in Container Station

After publishing, use this Docker Compose:

```yaml
services:
  season-ticket-app:
    image: your-username/season-ticket-manager:latest
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
- No build time in Container Station
- Faster deployments
- Version control of images
- Easy distribution across multiple systems