# Automatic GitHub Updates for Container Station

## Updated Docker Compose Configuration

Your `docker-compose.yml` now pulls directly from GitHub:

```yaml
services:
  app:
    build:
      context: https://github.com/jjcsf/TicketTracker.git
      dockerfile: Dockerfile
```

## How to Update Your Container

### Manual Update (Rebuild from GitHub)
```bash
cd /share/Container/projects/SeasonTicketTracker
docker-compose down
docker-compose pull
docker-compose up -d --build --no-cache
```

### Automatic Updates with Watchtower
Use `docker-compose.git-enabled.yml` for automatic updates:

```bash
cd /share/Container/projects/SeasonTicketTracker
docker-compose -f docker-compose.git-enabled.yml up -d
```

This includes Watchtower which checks for updates every 5 minutes.

## Workflow

1. **Make changes** in Replit
2. **Push to GitHub** using Version Control tab
3. **Update container** with one command:
   ```bash
   docker-compose up -d --build --no-cache
   ```

## Benefits

- No need to manually clone repositories
- Always gets latest code from GitHub
- Container rebuilds with fresh source code
- Single command updates
- Optional automatic updates with Watchtower

Your container will now pull the complete React application instead of serving a static page.