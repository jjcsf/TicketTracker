# Docker Deployment Guide for Container Station

This guide explains how to deploy the Season Ticket Management Platform to Docker in Container Station.

## Prerequisites

- Container Station installed and running
- Docker and Docker Compose available
- PostgreSQL database (can use the included one or external)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables in .env**:
   ```
   # Database Configuration
   DATABASE_URL=postgresql://postgres:password@postgres:5432/ticket_management
   PGDATABASE=ticket_management
   PGUSER=postgres
   PGPASSWORD=password
   PGHOST=postgres
   PGPORT=5432

   # Session Configuration
   SESSION_SECRET=your-super-secret-session-key-here

   # Replit Auth (if using)
   REPL_ID=your-repl-id
   ISSUER_URL=https://replit.com/oidc
   REPLIT_DOMAINS=your-domain.com

   # External API Keys (optional)
   SEATGEEK_CLIENT_ID=your-seatgeek-client-id
   SEATGEEK_CLIENT_SECRET=your-seatgeek-client-secret
   STUBHUB_API_KEY=your-stubhub-api-key
   ```

3. **Deploy with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations**:
   ```bash
   docker-compose exec app npm run db:push
   ```

5. **Access the application**:
   - Application: http://localhost:5000
   - Database: localhost:5432

### Option 2: Using Dockerfile Only

1. **Build the image**:
   ```bash
   docker build -t ticket-management .
   ```

2. **Run with external database**:
   ```bash
   docker run -d \
     --name ticket-management \
     -p 5000:5000 \
     -e DATABASE_URL="your-database-url" \
     -e SESSION_SECRET="your-session-secret" \
     ticket-management
   ```

## Container Station Setup

### Method 1: Using Container Station UI

1. **Upload files**:
   - Copy all project files to your Container Station host
   - Ensure docker-compose.yml and .env are configured

2. **Create Application**:
   - Open Container Station
   - Go to Applications → Create
   - Select "Docker Compose"
   - Upload or paste the docker-compose.yml content
   - Configure environment variables

3. **Deploy**:
   - Click Create to deploy the stack
   - Monitor logs for successful startup

### Method 2: Using SSH/Terminal

1. **Connect to Container Station host**:
   ```bash
   ssh user@your-container-station-host
   ```

2. **Transfer project files**:
   ```bash
   scp -r project-folder/ user@host:/path/to/deployment/
   ```

3. **Deploy**:
   ```bash
   cd /path/to/deployment/
   docker-compose up -d
   ```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret key for session encryption |
| `REPL_ID` | No | Replit authentication ID |
| `REPLIT_DOMAINS` | No | Allowed domains for Replit auth |
| `SEATGEEK_CLIENT_ID` | No | SeatGeek API client ID |
| `SEATGEEK_CLIENT_SECRET` | No | SeatGeek API client secret |
| `STUBHUB_API_KEY` | No | StubHub API key |

### Port Configuration

- **Application**: 5000 (configurable in docker-compose.yml)
- **Database**: 5432 (if using included PostgreSQL)

### Volume Mounts

- `postgres_data`: Persistent PostgreSQL data storage
- Database initialization script mounted automatically

## Maintenance

### Updating the Application

1. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

2. **Rebuild and restart**:
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

### Database Migrations

```bash
docker-compose exec app npm run db:push
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Backup Database

```bash
docker-compose exec postgres pg_dump -U postgres ticket_management > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U postgres ticket_management < backup.sql
```

## Troubleshooting

### Application Won't Start

1. Check logs: `docker-compose logs app`
2. Verify environment variables are set correctly
3. Ensure database is accessible
4. Check port conflicts

### Database Connection Issues

1. Verify DATABASE_URL format
2. Check PostgreSQL container status: `docker-compose ps`
3. Test connection: `docker-compose exec postgres psql -U postgres -d ticket_management`

### Port Already in Use

```bash
# Change ports in docker-compose.yml
ports:
  - "8080:5000"  # Use port 8080 instead of 5000
```

## Security Considerations

1. **Change default passwords** in production
2. **Use strong SESSION_SECRET** (generate with: `openssl rand -base64 32`)
3. **Configure firewall** to restrict database access
4. **Use HTTPS** in production (configure reverse proxy)
5. **Regular backups** of database and configurations

## Performance Optimization

### For Production Deployment

1. **Resource Limits**:
   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
           reservations:
             cpus: '0.5'
             memory: 512M
   ```

2. **Database Tuning**:
   ```yaml
   postgres:
     command: postgres -c shared_preload_libraries=pg_stat_statements -c max_connections=200
   ```

3. **Enable PostgreSQL Connection Pooling**:
   - Consider using PgBouncer for high-traffic scenarios

## Support

For deployment issues:
1. Check Container Station documentation
2. Review Docker and Docker Compose logs
3. Verify network connectivity between containers
4. Ensure all required environment variables are configured