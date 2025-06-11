# Season Ticket Management System

A comprehensive ticket management platform for sports teams providing analytics, financial tracking, and seat ownership management.

## Features

- **Team & Season Management**: Organize teams, seasons, and game schedules
- **Seat Ownership Tracking**: Manage seat licenses, assignments, and transfers
- **Financial Analytics**: Track payments, payouts, and profitability by ticket holder
- **Market Pricing Integration**: Real-time pricing data from SeatGeek and StubHub
- **Performance Analytics**: Team performance tracking and seat value predictions
- **Attendance Management**: Monitor game attendance and seat utilization

## Technology Stack

- **Frontend**: React with TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (development) / Container bypass (production)
- **External APIs**: SeatGeek, StubHub integration
- **Deployment**: Docker with Container Station support

## Quick Start

### Development (Replit)
```bash
npm install
npm run dev
```

### Container Station Deployment
1. Copy entire project to `/share/Container/projects/SeasonTicketTracker/`
2. Deploy using docker-compose.yml
3. Access at `http://your-nas-ip:5050`

## Database Schema

The system includes comprehensive tables for:
- Teams, seasons, and games
- Ticket holders and seat ownership
- Financial transactions (payments/payouts)
- Game pricing and attendance tracking
- Performance analytics and predictions

## Sample Data

Container deployment includes realistic sample data:
- 49ers team with 2024/2025 seasons
- Section 119 seats with ownership assignments
- Game schedules with pricing
- Financial transactions and attendance records

## Environment Variables

```env
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-session-secret
SEATGEEK_CLIENT_ID=your-client-id
SEATGEEK_CLIENT_SECRET=your-client-secret
STUBHUB_API_KEY=your-api-key
```

## API Endpoints

- `/api/teams` - Team management
- `/api/seasons` - Season tracking
- `/api/games` - Game scheduling
- `/api/seats` - Seat management
- `/api/ticket-holders` - Owner information
- `/api/dashboard/stats` - Analytics dashboard

## License

Private project for season ticket management.