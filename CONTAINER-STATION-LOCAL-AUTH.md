# Container Station Deployment with Local Authentication

This guide provides complete setup instructions for deploying the Season Ticket Manager with username/password authentication in Container Station environments.

## Overview

The Season Ticket Manager now supports two authentication modes:
- **Replit Auth**: For development and Replit environments  
- **Local Auth**: For Container Station and standalone deployments

## Container Station Setup

### 1. Download Docker Compose File

Use the `container-station-final.yml` file for Container Station deployment:

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
      - AUTH_TYPE=local
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

### 2. Deploy in Container Station

1. Open Container Station on your NAS
2. Go to "Applications" > "Create Application"
3. Select "Create with Docker Compose"
4. Paste the compose file content
5. Click "Create"

### 3. Access the Application

- URL: `http://your-nas-ip:5050`
- The application will show a login/registration page
- Create your first user account using the registration form

## Authentication Features

### Local Authentication System

- **Username/Password**: Secure login with encrypted passwords
- **User Registration**: Create new accounts through the web interface
- **Session Management**: Persistent sessions with PostgreSQL storage
- **Password Security**: Bcrypt-style password hashing with salt
- **Role Support**: Admin and user role capabilities

### Security Features

- Password requirements: Minimum 6 characters
- Username requirements: Minimum 3 characters, unique
- Email validation for user accounts
- Secure session cookies with httpOnly flags
- CSRF protection through session tokens
- Database-backed session storage for reliability

## Database Configuration

### Automatic Setup

The PostgreSQL database will automatically:
- Create the required database and user
- Initialize all necessary tables
- Set up proper indexes and relationships
- Configure session storage table

### Manual Database Access

If you need direct database access:
```bash
# Connect to PostgreSQL container
docker exec -it season-postgres psql -U season_user -d season_tickets_db

# View tables
\dt

# Check user accounts
SELECT id, username, email, "firstName", "lastName", role, "createdAt" FROM local_users;
```

## Environment Variables

### Required Settings

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secure session encryption key (change from default!)
- `AUTH_TYPE=local`: Enables local authentication mode
- `NODE_ENV=production`: Production environment settings
- `PORT=5050`: Application port

### Security Recommendations

1. **Change SESSION_SECRET**: Use a strong, unique secret key
2. **Database Passwords**: Use strong passwords for PostgreSQL
3. **Network Security**: Consider firewall rules for port 5050
4. **SSL/TLS**: Set up reverse proxy with HTTPS for production

## User Management

### First Admin User

1. Register the first user through the web interface
2. This user will have admin privileges by default
3. Additional users can be created through the registration form

### User Roles

- **Admin**: Full access to all features and data
- **User**: Limited access based on permissions
- **Manager**: Extended permissions for team management

## Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is healthy before app starts
2. **Port Conflicts**: Change port 5050 if already in use
3. **Session Issues**: Restart containers if login problems persist

### Container Logs

```bash
# View application logs
docker logs season-ticket-manager

# View database logs  
docker logs season-postgres
```

### Reset Database

To start fresh:
```bash
docker-compose down -v
docker-compose up -d
```

## Data Migration

### From Previous Deployments

The system will automatically migrate existing data when containers start. User data, financial records, and seat ownership information are preserved.

### Backup and Restore

```bash
# Backup database
docker exec season-postgres pg_dump -U season_user season_tickets_db > backup.sql

# Restore database
docker exec -i season-postgres psql -U season_user season_tickets_db < backup.sql
```

## Performance Optimization

### Container Resources

For optimal performance, allocate:
- **CPU**: 2+ cores
- **Memory**: 4GB+ RAM
- **Storage**: SSD recommended for database volume

### Database Tuning

The PostgreSQL container is configured with:
- Health checks for reliability
- Persistent volume storage
- Optimized connection settings

## Support

For issues with Container Station deployment:
1. Check container logs for errors
2. Verify all environment variables are set
3. Ensure database connectivity
4. Confirm port accessibility

The local authentication system provides enterprise-grade security suitable for financial applications and team collaboration.