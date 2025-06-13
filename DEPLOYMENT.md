# Season Ticket Manager - Container Deployment Guide

## Overview
This guide explains how to deploy the Season Ticket Manager application using Docker containers in a production environment.

## Prerequisites
- Docker and Docker Compose installed
- PostgreSQL database available
- Environment variables configured

## Quick Start

### 1. Environment Configuration
Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-session-secret-key
REPLIT_DOMAINS=your-domain.com,localhost:5050
REPL_ID=your-repl-id
ISSUER_URL=https://replit.com/oidc
NODE_ENV=production
PORT=5050
```

**Required for Authentication:**
- `REPLIT_DOMAINS`: Comma-separated list of domains where the app will be deployed
- `REPL_ID`: Your Replit application ID for OAuth (obtain from Replit dashboard)
- `ISSUER_URL`: Replit's OpenID Connect issuer URL (default: https://replit.com/oidc)
- `SESSION_SECRET`: Secure random string for session encryption (generate with: `openssl rand -base64 32`)

## Authentication Setup

### Getting Replit OAuth Credentials

1. **Create a Replit Account**: Sign up at https://replit.com
2. **Create a New Repl**: Set up a development environment
3. **Get REPL_ID**: Found in your Repl's URL or settings
4. **Configure Domains**: Add your production domains to REPLIT_DOMAINS

### Authentication Flow

The application uses Replit's OpenID Connect for secure authentication:

1. Users click "Login" and are redirected to Replit
2. After authentication, users are redirected back to your app
3. Session is established with secure cookies
4. Protected routes require valid authentication

### Login URLs

- **Development**: `http://localhost:5050/api/login`
- **Production**: `https://your-domain.com/api/login`
- **Logout**: `/api/logout`

### User Session Management

- Sessions are stored in PostgreSQL with automatic cleanup
- Session duration: 7 days
- Secure cookies with httpOnly and secure flags
- Automatic token refresh for extended sessions

### 2. Build and Deploy with Docker Compose
```bash
docker-compose up -d --build
```

### 3. Deploy with Docker Only
```bash
# Build the image
docker build -t season-ticket-manager .

# Run the container
docker run -d \
  --name season-ticket-manager \
  -p 5050:5050 \
  --env-file .env \
  season-ticket-manager
```

## Architecture

The application uses a multi-stage Docker build:

1. **Build Stage**: Installs all dependencies and builds both frontend and backend
2. **Production Stage**: Keeps only production dependencies and runs the optimized server

## Key Components

### Production Server (`server/docker.ts`)
- Lightweight Express server without Vite dependencies
- Static file serving for the built React frontend
- API routing and database connections
- Error handling and logging

### Database Schema
The application includes comprehensive database tables:
- Users and authentication (sessions)
- Teams and seasons management
- Games and scheduling
- Seat management and ownership
- Financial tracking (payments, payouts)
- Analytics and predictions

## Features Available in Container

### Dashboard Analytics
- Season financial summaries
- Ticket holder profit tracking
- Seat value predictions
- Team performance analytics

### Seat Management
- Seat ownership tracking
- License cost management
- Transfer handling
- Attendance monitoring

### Financial Tracking
- Payment processing
- Payout calculations
- Cost analysis
- Revenue reporting

## Port Configuration
- Default port: 5050
- Configurable via PORT environment variable
- Container exposes port 5050

## Database Requirements
- PostgreSQL database required
- Database schema automatically handled by Drizzle ORM
- Run `npm run db:push` to initialize schema if needed

## Troubleshooting

### Container Won't Start
1. Check database connectivity
2. Verify environment variables
3. Ensure port 5050 is available

### Database Issues
1. Verify DATABASE_URL format
2. Check database permissions
3. Run schema migration if needed

### Static Files Not Loading
1. Ensure build completed successfully
2. Check file permissions in container
3. Verify static file paths

## Production Considerations

### Security
- Use secure session secrets
- Enable HTTPS in production
- Restrict database access
- Use environment-specific configurations

### Performance
- Database connection pooling enabled
- Static file caching
- Compressed assets
- Optimized bundle sizes

### Monitoring
- Application logs available via Docker logs
- Health check endpoints available
- Performance metrics tracked

## Support
For deployment issues, check the application logs:
```bash
docker logs season-ticket-manager
```