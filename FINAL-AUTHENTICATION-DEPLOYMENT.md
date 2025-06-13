# Final Authentication Debug Deployment

## Complete Debug Package Ready
The Docker container now includes comprehensive authentication debugging to identify the exact issue:

### Debug Features Added
- Route registration logging for all authentication endpoints
- Request tracing middleware to track API calls
- Route listing endpoint at `/api/debug/routes` 
- Complete authentication flow logging
- Database connection status tracking

### Deployment Instructions

1. **Stop Current Container**
```bash
docker-compose down
```

2. **Build Debug Image**
```bash
docker build -f Dockerfile -t jjcsf/season-ticket-manager:debug .
```

3. **Update Docker Compose File**
```yaml
version: '3.8'
services:
  season-ticket-manager:
    image: jjcsf/season-ticket-manager:debug
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

4. **Deploy and Monitor**
```bash
docker-compose up -d
docker logs season-ticket-manager -f
```

### Debugging Steps

1. **Check Container Startup**
Look for these logs on startup:
```
[docker] Season Ticket Manager running on port 5050
[container] Registering container auth routes
[auth] Setting up local authentication middleware
[auth] Registering /api/auth/register route
[auth] Registering /api/auth/login route
[auth] All authentication routes registered successfully
```

2. **Test Route Registration**
Visit: `http://your-qnap-ip:5050/api/debug/routes`
Should show all registered routes including `/api/auth/register`

3. **Monitor Registration Attempts**
When clicking "Create Account", look for:
```
[docker] POST /api/auth/register
[auth] POST /api/auth/register called with body: {...}
```

### Expected Resolution
This debug version will reveal:
- Whether authentication routes are being registered
- If requests are reaching the authentication handlers  
- Any middleware conflicts or database connection issues
- The exact point where the authentication flow fails

The comprehensive logging will identify the root cause of the "not a valid HTTP method" error and provide the information needed for a permanent fix.