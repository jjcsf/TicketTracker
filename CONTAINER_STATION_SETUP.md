# Container Station Deployment Guide

## Quick Setup for Container Station

### Prerequisites
- QNAP NAS with Container Station installed
- Minimum 4GB RAM allocated to Container Station
- Docker and Docker Compose enabled

### Step 1: Transfer Files
1. Upload all project files to your NAS shared folder
2. Access Container Station web interface
3. Navigate to Applications → Create → Docker Compose

### Step 2: Environment Configuration
Create a `.env` file with these settings:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:ticketpass123@postgres:5432/ticket_management
PGDATABASE=ticket_management
PGUSER=postgres
PGPASSWORD=ticketpass123
PGHOST=postgres
PGPORT=5432

# Security
SESSION_SECRET=ticket-management-super-secret-key-2025

# External APIs (Optional - add if you have keys)
SEATGEEK_CLIENT_ID=your_seatgeek_client_id
SEATGEEK_CLIENT_SECRET=your_seatgeek_client_secret
STUBHUB_API_KEY=your_stubhub_api_key
```

### Step 3: Deploy Using Container Station UI

1. **Open Container Station**
2. **Create Application**:
   - Click "Applications" → "Create"
   - Select "Docker Compose"
   - Name: `ticket-management`

3. **Paste Docker Compose Configuration**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:ticketpass123@postgres:5432/ticket_management
      - SESSION_SECRET=ticket-management-super-secret-key-2025
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

4. **Deploy**: Click "Create" to deploy the application

### Step 4: Initialize Database
After deployment, run the database setup:

1. Open Terminal in Container Station
2. Find your app container: `docker ps`
3. Execute migration: 
   ```bash
   docker exec -it ticket-management_app_1 npm run db:push
   ```

### Step 5: Access Application
- Application: `http://your-nas-ip:8080`
- Database: `your-nas-ip:5432` (if needed for external tools)

## Alternative: Command Line Deployment

If you prefer SSH access:

```bash
# 1. SSH to your NAS
ssh admin@your-nas-ip

# 2. Navigate to shared folder
cd /share/Container/projects/ticket-management

# 3. Deploy
docker-compose up -d

# 4. Initialize database
docker-compose exec app npm run db:push
```

## Network Configuration

### Port Mapping
- **8080**: Web application (external access)
- **5432**: PostgreSQL (internal/optional external)

### Firewall Setup
1. QNAP Control Panel → Network & File Services
2. Firewall → Create Rule
3. Allow port 8080 for HTTP access

## Troubleshooting

### Common Issues

**Container Won't Start**
```bash
# Check logs
docker-compose logs app

# Check container status
docker-compose ps
```

**Database Connection Failed**
```bash
# Test database
docker-compose exec postgres psql -U postgres -d ticket_management

# Reset database
docker-compose down -v
docker-compose up -d
```

**Port Already in Use**
- Change port in docker-compose.yml: `"8081:5000"`
- Or stop conflicting service in Container Station

### Performance Optimization

**Resource Limits** (edit in Container Station UI):
- CPU: 2 cores
- Memory: 2GB
- Storage: 10GB minimum

**Database Tuning**:
```yaml
postgres:
  command: postgres -c max_connections=100 -c shared_buffers=256MB
```

## Backup & Maintenance

### Database Backup
```bash
docker-compose exec postgres pg_dump -U postgres ticket_management > backup_$(date +%Y%m%d).sql
```

### Application Update
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Log Management
```bash
# View application logs
docker-compose logs -f app

# View database logs  
docker-compose logs -f postgres

# Clear logs (if needed)
docker system prune
```

## Security Considerations

1. **Change Default Passwords**: Update PostgreSQL password in production
2. **Enable HTTPS**: Use reverse proxy (nginx) for SSL termination
3. **Network Isolation**: Use Container Station's network isolation features
4. **Regular Updates**: Keep containers updated with latest security patches

## Monitoring

Container Station provides built-in monitoring:
- CPU/Memory usage graphs
- Container health status
- Log aggregation
- Performance metrics

Access via Container Station → Applications → Your App → Details

## Support

For deployment issues:
1. Check Container Station logs
2. Verify Docker Compose syntax
3. Ensure sufficient resources allocated
4. Test network connectivity between containers