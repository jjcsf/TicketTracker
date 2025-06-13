# Container Authentication Fix

## Issue
The container deployment has corrected static file paths but needs to be rebuilt with the latest authentication fixes.

## Quick Fix Steps

### 1. Stop Current Container
```bash
docker-compose down
```

### 2. Rebuild with Latest Code
```bash
# Build the frontend
npm run build

# Build the container server
npx esbuild server/docker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/docker.js

# Build new Docker image
docker build -f Dockerfile -t jjcsf/season-ticket-manager:fixed .
```

### 3. Update Docker Compose
Change the image tag in your docker-compose.yml:
```yaml
services:
  season-ticket-manager:
    image: jjcsf/season-ticket-manager:fixed  # Changed from :latest
```

### 4. Deploy Fixed Version
```bash
docker-compose up -d
```

## What Was Fixed
- Corrected static file paths in Docker container (dist/public → public)
- Fixed index.html serving path for SPA routing
- Authentication routes are properly configured for local auth

## Verification
After deployment:
1. Access http://your-qnap-ip:5050
2. Registration form should work correctly
3. Database connection will initialize automatically
4. First user gets admin privileges

The authentication error `/api/auth/register` not being a valid HTTP method should be resolved with these path corrections.