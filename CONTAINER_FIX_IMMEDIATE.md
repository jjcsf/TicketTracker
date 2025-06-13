# IMMEDIATE FIX: GitHub Repository Dockerfile Update

## Problem Identified
The GitHub repository contains the correct working dashboard server (`container-dashboard-server.js`) but the Dockerfile points to the wrong file (`container-complete-server.js` which serves a loading screen).

## One-Line Fix Required on GitHub

**Current Dockerfile Line 22:**
```
COPY container-complete-server.js ./
```

**Change to Line 22:**
```
COPY container-dashboard-server.js ./
```

## Instructions:
1. Visit: https://github.com/jjcsf/TicketTracker/blob/main/Dockerfile
2. Click "Edit this file" (pencil icon)
3. Find line 22 and change `container-complete-server.js` to `container-dashboard-server.js`
4. Commit message: "Fix server file reference"
5. Click "Commit changes"

## Result:
GitHub Actions will automatically rebuild the Docker image with the working dashboard. After rebuild completes (5-10 minutes), pull the updated image:

```bash
docker pull jjcsf/season-ticket-manager:latest
docker-compose down
docker-compose up -d
```

Container will then display the functional 49ers season ticket dashboard with:
- Interactive tables and data
- Real financial calculations
- Seat ownership tracking
- Game scheduling
- All Replit preview functionality