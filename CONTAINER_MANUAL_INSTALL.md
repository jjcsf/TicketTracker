# Container Station Manual Installation

Your Container Station can't access Git directly. Here's the manual installation method:

## Step 1: Download Project Archive
1. Download `season-ticket-container.tar.gz` from your Replit project
2. Upload to your NAS file manager

## Step 2: Extract on NAS
SSH to your NAS and run:
```bash
cd /share/Container/projects/
rm -rf SeasonTicketTracker
mkdir SeasonTicketTracker
cd SeasonTicketTracker
tar -xzf /path/to/season-ticket-container.tar.gz
```

## Step 3: Deploy with Direct Docker Compose
```bash
docker-compose -f docker-compose.direct.yml down
docker-compose -f docker-compose.direct.yml up -d --build
```

## Step 4: Access Application
Navigate to: `http://your-nas-ip:5050`

## Features Included:
- Interactive React dashboard
- Authentication bypass for container admin
- Complete database with 49ers data
- All ticket management features
- Financial analytics and reporting

## Troubleshooting:
If port 5050 is in use, modify docker-compose.direct.yml:
```yaml
ports:
  - "5051:5050"  # Change external port
```

This method bypasses Git requirements and deploys directly from source files.