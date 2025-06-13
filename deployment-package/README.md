# Season Ticket Manager - Container Station Deployment

## Quick Start
1. Upload all files to your Container Station host
2. Run: `docker-compose -f docker-compose-minimal.yml up -d`
3. Access: `http://your-nas-ip:5050`

## Files Included
- Dockerfile.minimal: Container build configuration
- docker-compose-minimal.yml: Complete deployment setup
- server/minimal-container.ts: Application source code
- package.json: Dependencies
- app.mjs: Pre-built application (14.7KB)

## First Run
- Register the first user account
- Login to access the dashboard
- Authentication uses secure sessions

## Monitoring
- Health check: `http://your-nas-ip:5050/api/test`
- Logs: `docker-compose logs -f season-ticket-manager`
