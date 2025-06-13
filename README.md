# Season Ticket Manager

A comprehensive web application for managing season tickets, seat ownership, and financial tracking for sports teams. Built with modern web technologies and designed for scalability.

## Features

### Dashboard & Analytics
- Real-time financial summaries and profit tracking
- Interactive charts and performance metrics
- Seat value predictions and market analysis
- Team performance correlation with ticket sales

### Seat Management
- Complete seat inventory tracking
- Ownership assignment and transfer management
- License cost tracking and amortization
- Section, row, and seat number organization

### Financial Operations
- Payment processing and tracking
- Automated payout calculations
- Cost analysis and revenue reporting
- Owner balance management

### Game Management
- Schedule management and game tracking
- Attendance monitoring
- Dynamic pricing based on performance
- Transfer request handling

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OpenID Connect)
- **UI Components**: Shadcn/ui, Radix UI
- **Data Fetching**: TanStack Query
- **Build Tools**: Vite, ESBuild

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Production Deployment
```bash
# Build the application
npm run build

# Start production server
npm start
```

### Container Deployment
```bash
# Using Docker Compose
docker-compose up -d --build

# Using Docker directly
docker build -t season-ticket-manager .
docker run -d -p 5050:5050 --env-file .env season-ticket-manager
```

## Environment Variables

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5050)

## Database Schema

The application manages the following core entities:
- **Teams**: Sports team information
- **Seasons**: Annual season tracking
- **Games**: Individual game scheduling
- **Seats**: Physical seat inventory
- **Ticket Holders**: Owner information
- **Seat Ownership**: Ownership assignments
- **Payments**: Financial transactions
- **Payouts**: Distribution calculations

## Key Functionality

### Owner Financials
Track comprehensive financial data including:
- Initial seat license investments
- Ongoing maintenance payments
- Game-by-game revenue sharing
- Net profit/loss calculations

### Predictive Analytics
- Seat value predictions based on team performance
- Market pricing analysis
- ROI projections for potential investors
- Historical trend analysis

### Transfer Management
- Ownership transfer requests
- Approval workflows
- Financial settlement tracking
- Legal documentation support

## API Endpoints

### Core Resources
- `/api/teams` - Team management
- `/api/seasons` - Season configuration
- `/api/games` - Game scheduling
- `/api/seats` - Seat inventory
- `/api/ticket-holders` - Owner management
- `/api/payments` - Financial transactions

### Analytics
- `/api/dashboard/stats` - Summary statistics
- `/api/reports/season-summary` - Detailed reports
- `/api/predictions/seat-values` - Value predictions

## Authentication

Uses Replit Auth with OpenID Connect for secure user authentication:
- Automatic user provisioning
- Session management
- Role-based access control
- Secure API endpoint protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is proprietary software for season ticket management.

## Support

For deployment and configuration support, see `DEPLOYMENT.md` for detailed container deployment instructions.