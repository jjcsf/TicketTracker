# Season Ticket Manager - Complete QNAP Deployment Guide

## Quick Setup Instructions

### 1. Copy Files to QNAP
```bash
scp deploy-complete-qnap.sh admin@YOUR-QNAP-IP:/share/Container/projects/SeasonTicketTracker/
```

### 2. Deploy on QNAP
```bash
ssh admin@YOUR-QNAP-IP
cd /share/Container/projects/SeasonTicketTracker/
sudo chmod +x deploy-complete-qnap.sh
sudo ./deploy-complete-qnap.sh
```

## What This Deployment Includes

### Complete Application Features
- **Authentication System**: Secure user registration and login
- **Dashboard**: Financial analytics with real-time calculations
- **Teams Management**: 49ers, Giants with full data structure
- **Season Tracking**: 2025 seasons with complete setup
- **Seat Management**: Section 119 with proper license costs
- **Ticket Holders**: John Doe, Jane Smith, Mike Johnson
- **Payment Tracking**: Revenue and cost reporting
- **Game Management**: Scheduling and opponent tracking

### Technical Stack
- **Container**: Ubuntu 22.04 LXD with 2GB RAM, 2 CPU cores
- **Database**: PostgreSQL with complete schema
- **Backend**: Node.js Express server with session management
- **Frontend**: Professional responsive web interface
- **Security**: Password hashing, session management, authentication
- **Persistence**: All data stored in PostgreSQL database

### Sample Data Included
- **License Costs**: Seats 2, 3, 4 = $9,996.39 each
- **Revenue**: $16,700 total season payments
- **Seat Ownership**: 7 seats assigned to 3 ticket holders
- **Financial Analytics**: Profit/loss calculations

## Access Your Application

1. **Application URL**: `http://YOUR-QNAP-IP:5050`
2. **Health Check**: `http://YOUR-QNAP-IP:5050/api/health`
3. **Create Account**: Register new user or login
4. **Explore Features**: Navigate through all tabs

## Application Features Available

### Dashboard
- Total Revenue: Real financial data
- Total Costs: License fees and expenses  
- Net Profit: Calculated profit/loss
- Active Seats: Current seat assignments

### Data Management Tabs
- **Teams**: Manage team information
- **Seasons**: Track season data
- **Seats**: View seat assignments and license costs
- **Ticket Holders**: Manage customer information
- **Games**: Schedule and track games
- **Payments**: Revenue and cost tracking

## Management Commands

```bash
# Check status
lxc exec season-ticket-manager -- systemctl status season-ticket-manager

# View logs
lxc exec season-ticket-manager -- journalctl -u season-ticket-manager -f

# Restart application
lxc exec season-ticket-manager -- systemctl restart season-ticket-manager

# Access container
lxc exec season-ticket-manager -- bash

# Check database
lxc exec season-ticket-manager -- su - ticketmgr -c "cd /opt/season-ticket-manager && node -e \"
const { pool } = require('./schema');
pool.query('SELECT COUNT(*) FROM users').then(result => {
  console.log('Users:', result.rows[0].count);
  process.exit(0);
});
\""
```

## Troubleshooting

### If Application Doesn't Start
```bash
# Check PostgreSQL
lxc exec season-ticket-manager -- systemctl status postgresql

# Check application logs
lxc exec season-ticket-manager -- journalctl -u season-ticket-manager -n 50

# Restart services
lxc exec season-ticket-manager -- systemctl restart postgresql
lxc exec season-ticket-manager -- systemctl restart season-ticket-manager
```

### Database Issues
```bash
# Connect to PostgreSQL
lxc exec season-ticket-manager -- su - postgres -c "psql seasontickets"

# Check tables
\dt

# Check sample data
SELECT * FROM teams;
SELECT * FROM seats;
SELECT * FROM payments;
```

## Project Structure
```
/opt/season-ticket-manager/
├── server.js           # Main application server
├── schema.js          # Database schema and initialization
├── package.json       # Node.js dependencies
└── node_modules/      # Installed packages
```

## Key Features Working

1. **Complete Authentication**: User registration, login, logout
2. **Financial Dashboard**: Real revenue, costs, profit calculations
3. **Data Management**: Full CRUD operations for all entities
4. **Professional UI**: Responsive design with tabbed navigation
5. **Database Persistence**: PostgreSQL with proper relationships
6. **Auto-Start**: Systemd service with automatic startup
7. **Resource Management**: Proper memory and CPU limits
8. **Health Monitoring**: Built-in health check endpoints

Your Season Ticket Manager is now fully operational with all features available.