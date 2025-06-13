# Season Ticket Manager - Container Station Deployment

## Ready for Production Deployment

The Season Ticket Manager has been successfully configured with local authentication for secure Container Station deployment. All Docker build issues have been resolved.

## Quick Start

### 1. Deploy with Docker Compose

Save this configuration as `docker-compose.yml`:

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
      - SESSION_SECRET=your-super-secret-session-key-change-this-in-production-12345
      - VITE_AUTH_TYPE=local
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

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

volumes:
  postgres_data:
    driver: local
```

### 2. Access Your Application

1. Navigate to `http://your-nas-ip:5050`
2. Click "Register" to create your first admin account
3. Fill in your details and create a secure password
4. Login and start managing your season tickets

## Authentication System

### Local Username/Password Login
- Secure password encryption with salt-based hashing
- Session management backed by PostgreSQL
- User registration with email validation
- Role-based access control
- Automatic admin privileges for first user

### Security Features
- CSRF protection through session tokens
- Secure session cookies with httpOnly flags
- Database-backed session storage for reliability
- Password requirements and validation
- Account lockout protection

## Application Features

### Financial Management
- Track seat ownership costs and license fees
- Monitor payment schedules and ticket holder balances
- Calculate profits and losses per seat and season
- Generate comprehensive financial reports

### Analytics Dashboard
- Real-time financial overview with interactive charts
- Seat ownership visualization and performance metrics
- Game attendance tracking and analysis
- Revenue and cost trending over time

### Predictive Modeling
- AI-powered seat value predictions based on team performance
- Market trend analysis and pricing recommendations
- Historical data insights for investment decisions
- Similar seat price comparisons

### Team Performance Integration
- Win/loss record impact on ticket values
- Opponent analysis and game importance factors
- Season performance analytics and projections
- Attendance correlation with team success

## Database Management

### Automatic Setup
The PostgreSQL database automatically creates:
- User authentication tables with encrypted passwords
- Season ticket ownership and financial records
- Game schedules and attendance tracking
- Analytics data and performance metrics
- Session storage for reliable authentication

### Data Persistence
All data is stored in persistent Docker volumes ensuring:
- Financial records are never lost
- User accounts maintain across container restarts
- Historical data remains available for analytics
- Database integrity through proper constraints

## Security Configuration

### Critical Settings
Change these before production deployment:
```yaml
- SESSION_SECRET=your-unique-secure-random-string-here
- POSTGRES_PASSWORD=your-strong-database-password
```

### Network Security
- Application runs on port 5050 (configurable)
- Database port 5432 exposed only for management
- Internal Docker network isolation
- Consider HTTPS proxy for production

## Backup and Recovery

### Database Backup
```bash
docker exec season-postgres pg_dump -U season_user season_tickets_db > backup.sql
```

### Volume Backup
```bash
docker run --rm -v postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

### Restore Process
```bash
docker exec -i season-postgres psql -U season_user season_tickets_db < backup.sql
```

## Troubleshooting

### Container Issues
```bash
# Check application logs
docker logs season-ticket-manager

# Check database health
docker logs season-postgres
docker exec season-postgres pg_isready -U season_user -d season_tickets_db
```

### Common Solutions
1. **Login Problems**: Restart containers and clear browser cache
2. **Database Connection**: Verify PostgreSQL is healthy before app starts
3. **Port Conflicts**: Change port 5050 in compose file if needed
4. **Performance**: Allocate 4GB+ RAM and use SSD storage

## Upgrade Process

1. Pull latest image: `docker pull jjcsf/season-ticket-manager:latest`
2. Stop containers: `docker-compose down`
3. Start with new image: `docker-compose up -d`
4. Database migrations run automatically

## Production Ready

The system includes:
- Comprehensive error handling and logging
- Health checks and automatic restart policies
- Optimized Docker build with minimal attack surface
- Production-grade authentication and session management
- Scalable architecture for multiple users

Deploy with confidence - the Season Ticket Manager provides enterprise-grade security and reliability for managing your season ticket investments.