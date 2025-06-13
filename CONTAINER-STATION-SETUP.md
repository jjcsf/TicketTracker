# Container Station Setup Guide

## Quick Setup for NAS Container Station

### Step 1: Prepare Environment Variables

Before deploying, you need these values:
- **REPL_ID**: Get from your Replit account
- **NAS_IP**: Your NAS IP address (e.g., 192.168.1.100)
- **SESSION_SECRET**: Generate with `openssl rand -base64 32`

### Step 2: Update the Compose File

Edit the environment variables in `docker-compose-container-station.yml`:

```yaml
environment:
  - REPLIT_DOMAINS=localhost:5050,YOUR_NAS_IP:5050,your-domain.com
  - REPL_ID=your-actual-repl-id
  - SESSION_SECRET=your-generated-session-secret
```

### Step 3: Deploy in Container Station

#### Method 1: Create Application
1. Open Container Station
2. Click "Create" → "Create Application"
3. Upload `docker-compose-container-station.yml`
4. Click "Create"

#### Method 2: YAML Import
1. Copy the contents of `docker-compose-container-station.yml`
2. In Container Station, go to "Create" → "Create Application"
3. Select "YAML" tab
4. Paste the compose content
5. Click "Create"

### Step 4: Access the Application

After deployment:
- **Application**: `http://YOUR_NAS_IP:5050`
- **Database**: `YOUR_NAS_IP:5432`

### Port Configuration

Default ports:
- **Web App**: 5050
- **PostgreSQL**: 5432

To change ports, modify the `ports` section:
```yaml
ports:
  - "8080:5050"  # Changes web port to 8080
```

### Storage Locations

Data is stored in named volumes:
- Database: `season_tickets_db`
- Logs: `season_tickets_logs`

### Container Management

View containers in Container Station:
- `season-ticket-manager` - Main application
- `season-tickets-db` - PostgreSQL database

### Troubleshooting

#### Container Won't Start
Check logs in Container Station for each container.

#### Can't Access Application
Verify firewall settings allow port 5050.

#### Database Connection Issues
Ensure PostgreSQL container is healthy before app starts.

### Security Notes

- Change default PostgreSQL password
- Use strong SESSION_SECRET
- Configure proper REPLIT_DOMAINS for your network
- Consider using reverse proxy for HTTPS