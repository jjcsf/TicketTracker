# Container Station Deployment - Season Ticket Manager

## Complete Local Authentication System

The Season Ticket Manager now includes a robust local authentication system specifically designed for Container Station deployments. This eliminates the need for external authentication services and provides enterprise-grade security.

## Quick Deployment

### 1. Download the Docker Compose File

Save this as `docker-compose.yml`:

```yaml
version: '3.8'

services:
  season-ticket-manager:
    image: jjcsf/season-ticket-manager:latest
    container_name: season-ticket-manager
    ports:
      - "5050:5050"
    environment:
      - NODE_ENV=production
      - PORT=5050
      - DATABASE_URL=postgresql://season_user:season_pass@postgres:5432/season_tickets_db
      - SESSION_SECRET=change-this-to-a-secure-random-string-in-production
      - VITE_AUTH_TYPE=local
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - season-network

  postgres:
    image: postgres:15-alpine
    container_name: season-postgres
    environment:
      - POSTGRES_DB=season_tickets_db
      - POSTGRES_USER=season_user
      - POSTGRES_PASSWORD=season_pass
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
    networks:
      - season-network

volumes:
  postgres_data:
    driver: local

networks:
  season-network:
    driver: bridge
```

### 2. Deploy in Container Station

1. Open Container Station
2. Go to Applications → Create Application
3. Select "Create with Docker Compose"
4. Paste the compose content above
5. Click "Create"

### 3. Access Your Application

- URL: `http://your-nas-ip:5050`
- Create your first admin account through the registration form
- Login and start managing your season tickets

## Authentication Features

### Secure Local Login System
- Username/password authentication with encrypted storage
- Session management with PostgreSQL backing
- Form validation and user feedback
- Account registration for new users
- Role-based access control

### Security Measures
- Password hashing with crypto.scrypt and salt
- Secure session cookies with httpOnly flags
- Database-backed session storage for reliability
- CSRF protection through session tokens
- Environment-based configuration

## Application Features

### Financial Management
- Track seat ownership costs and revenues
- Monitor payment schedules and balances
- Calculate profits and losses per seat
- Generate financial reports and summaries

### Predictive Analytics
- AI-powered seat value predictions
- Market trend analysis
- Performance-based pricing recommendations
- Historical data insights

### Team Performance Tracking
- Win/loss record impact on ticket values
- Game attendance monitoring
- Season performance analytics
- Opponent analysis

### Comprehensive Dashboard
- Real-time financial overview
- Interactive charts and graphs
- Seat ownership visualization
- Quick access to key metrics

## Database Configuration

The PostgreSQL database automatically creates all required tables including:
- User accounts and authentication
- Season ticket ownership records
- Financial transactions and payments
- Game schedules and attendance
- Predictive analytics data

## Environment Variables

### Critical Settings
- `SESSION_SECRET`: Change to a unique secure string
- `DATABASE_URL`: PostgreSQL connection (automatically configured)
- `VITE_AUTH_TYPE=local`: Enables local authentication
- `NODE_ENV=production`: Production optimizations

### Security Recommendations
1. Change the default `SESSION_SECRET` to a strong random string
2. Use strong passwords for the PostgreSQL database
3. Consider setting up HTTPS with a reverse proxy
4. Restrict network access to necessary ports only

## Troubleshooting

### Container Startup Issues
```bash
# Check container logs
docker logs season-ticket-manager
docker logs season-postgres

# Verify database connectivity
docker exec season-postgres pg_isready -U season_user -d season_tickets_db
```

### Login Problems
1. Ensure the database is running and healthy
2. Check that SESSION_SECRET is set
3. Clear browser cache and cookies
4. Restart the application container if needed

### Performance Optimization
- Allocate at least 4GB RAM to the containers
- Use SSD storage for the PostgreSQL volume
- Ensure adequate CPU resources (2+ cores recommended)

## Data Backup and Recovery

### Backup Database
```bash
docker exec season-postgres pg_dump -U season_user season_tickets_db > backup.sql
```

### Restore Database
```bash
docker exec -i season-postgres psql -U season_user season_tickets_db < backup.sql
```

### Volume Backup
```bash
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Upgrading

To upgrade to a newer version:
1. Pull the latest image: `docker pull jjcsf/season-ticket-manager:latest`
2. Stop containers: `docker-compose down`
3. Start with new image: `docker-compose up -d`

## Support and Maintenance

The system is designed for minimal maintenance with:
- Automatic database migrations
- Health checks and restart policies
- Persistent data storage
- Comprehensive error logging

For additional support or customization needs, all source code and documentation is available in the deployment package.