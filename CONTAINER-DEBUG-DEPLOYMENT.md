# Container Debug Deployment - Authentication Troubleshooting

## Debug Version Built
The Docker container has been rebuilt with comprehensive logging to trace the authentication issue:

- Authentication route registration logging
- Request tracing middleware  
- Route handler execution logs
- Database connection status

## Deployment Steps

### 1. Stop Current Container
```bash
docker-compose down
```

### 2. Build Debug Version
```bash
# Build with debug logging
docker build -f Dockerfile -t jjcsf/season-ticket-manager:debug .
```

### 3. Update Docker Compose
```yaml
version: '3.8'

services:
  season-ticket-manager:
    image: jjcsf/season-ticket-manager:debug  # Debug version
    container_name: season-ticket-manager
    ports:
      - "5050:5050"
    environment:
      NODE_ENV: production
      PORT: 5050
      DATABASE_URL: postgresql://season_user:season_pass@postgres:5432/season_tickets_db
      SESSION_SECRET: your-super-secret-session-key-change-this-in-production-12345
      VITE_AUTH_TYPE: local
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    container_name: season-postgres
    environment:
      POSTGRES_DB: season_tickets_db
      POSTGRES_USER: season_user
      POSTGRES_PASSWORD: season_pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U season_user -d season_tickets_db"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
```

### 4. Deploy and Monitor
```bash
docker-compose up -d
docker logs season-ticket-manager -f
```

## Expected Debug Output

When the container starts, you should see:
```
[docker] Season Ticket Manager running on port 5050
[docker] Using local authentication system
[auth] Setting up local authentication middleware
[auth] Registering /api/auth/register route
[auth] Registering /api/auth/login route
[auth] Registering /api/auth/logout route
[auth] Registering /api/auth/user route
```

When you try to register, you should see:
```
[docker] POST /api/auth/register
[auth] POST /api/auth/register called with body: { username: "...", email: "..." }
```

## Troubleshooting

### If Routes Aren't Registered
- Check if authentication middleware setup is being called
- Verify database connection is successful
- Ensure session store initializes properly

### If Routes Are Registered But Not Responding
- Check for middleware conflicts
- Verify static file serving isn't intercepting requests
- Review route order in Express app

### If Database Issues
- Confirm PostgreSQL is healthy: `docker exec season-postgres pg_isready`
- Check database connection: `docker logs season-postgres`
- Verify tables are created automatically

This debug version will reveal exactly where the authentication flow is failing.