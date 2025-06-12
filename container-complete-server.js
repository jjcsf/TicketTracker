import express from 'express';
import path from 'path';
import cors from 'cors';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ticketpass123@postgres:5432/ticket_management',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function initDatabase() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connected successfully');
      break;
    } catch (error) {
      console.log(`Database retry ${retries}: ${error.message}`);
      retries--;
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY,
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        city VARCHAR,
        league VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        year INTEGER NOT NULL,
        name VARCHAR,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        season_id INTEGER REFERENCES seasons(id),
        opponent VARCHAR NOT NULL,
        date DATE NOT NULL,
        time TIME,
        is_home BOOLEAN DEFAULT true,
        is_playoff BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ticket_holders (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        email VARCHAR UNIQUE,
        phone VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seats (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        section VARCHAR NOT NULL,
        row VARCHAR NOT NULL,
        number VARCHAR NOT NULL,
        license_cost DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seat_ownership (
        id SERIAL PRIMARY KEY,
        seat_id INTEGER REFERENCES seats(id),
        season_id INTEGER REFERENCES seasons(id),
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        season_id INTEGER REFERENCES seasons(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_date DATE DEFAULT CURRENT_DATE,
        description VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        game_id INTEGER REFERENCES games(id),
        amount DECIMAL(10,2) NOT NULL,
        payout_date DATE DEFAULT CURRENT_DATE,
        description VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_pricing (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        seat_id INTEGER REFERENCES seats(id),
        cost DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_attendance (
        id SERIAL PRIMARY KEY,
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        seat_id INTEGER REFERENCES seats(id),
        game_id INTEGER REFERENCES games(id),
        attended BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS transfers (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        from_ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        to_ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        seat_id INTEGER REFERENCES seats(id),
        transfer_date DATE DEFAULT CURRENT_DATE,
        status VARCHAR DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );

      INSERT INTO teams (name, city, league) VALUES 
        ('49ers', 'San Francisco', 'NFL'),
        ('Giants', 'San Francisco', 'MLB')
      ON CONFLICT DO NOTHING;

      INSERT INTO ticket_holders (name, email, phone) VALUES 
        ('Container Admin', 'admin@container.local', '555-0100'),
        ('Cale', 'cale.john@gmail.com', '555-0101'),
        ('John Smith', 'john@example.com', '555-0102'),
        ('Jane Doe', 'jane@example.com', '555-0103')
      ON CONFLICT DO NOTHING;

      INSERT INTO seasons (team_id, year, name, start_date, end_date) VALUES 
        (1, 2024, '2024 Season', '2024-09-01', '2025-02-28'),
        (1, 2025, '2025 Season', '2025-09-01', '2026-02-28')
      ON CONFLICT DO NOTHING;

      INSERT INTO seats (team_id, section, row, number, license_cost) VALUES 
        (1, '119', '1', '1', 0.00),
        (1, '119', '1', '2', 9996.39),
        (1, '119', '1', '3', 9996.39),
        (1, '119', '1', '4', 9996.39),
        (1, '119', '1', '5', 0.00),
        (1, '119', '1', '6', 0.00),
        (1, '119', '1', '7', 0.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO seat_ownership (seat_id, season_id, ticket_holder_id) VALUES
        (1, 1, 2), (2, 1, 2), (3, 1, 3), (4, 1, 2), (5, 1, 4), (6, 1, 4), (7, 1, 4),
        (2, 2, 2), (3, 2, 3), (4, 2, 2)
      ON CONFLICT DO NOTHING;

      INSERT INTO games (season_id, opponent, date, time, is_home) VALUES
        (1, 'Cardinals', '2024-10-12', '13:00', true),
        (1, 'Seahawks', '2024-10-20', '16:00', true),
        (1, 'Cowboys', '2024-10-27', '20:00', false),
        (2, 'Rams', '2025-09-15', '13:00', true),
        (2, 'Packers', '2025-09-22', '16:00', true)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_pricing (game_id, seat_id, cost) VALUES
        (1, 2, 450.00), (1, 3, 450.00), (1, 4, 450.00),
        (2, 2, 520.00), (2, 3, 520.00), (2, 4, 520.00),
        (3, 2, 380.00), (3, 3, 380.00), (3, 4, 380.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_attendance (ticket_holder_id, seat_id, game_id, attended) VALUES
        (2, 2, 1, true), (3, 3, 1, true), (2, 4, 1, false),
        (2, 2, 2, true), (3, 3, 2, false), (2, 4, 2, true)
      ON CONFLICT DO NOTHING;

      INSERT INTO payments (ticket_holder_id, season_id, amount, description) VALUES
        (2, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 2'),
        (2, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 4'),
        (3, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 3')
      ON CONFLICT DO NOTHING;

      INSERT INTO payouts (ticket_holder_id, game_id, amount, description) VALUES
        (2, 1, 450.00, 'Game attendance payout - Cardinals'),
        (3, 1, 450.00, 'Game attendance payout - Cardinals'),
        (2, 2, 520.00, 'Game attendance payout - Seahawks')
      ON CONFLICT DO NOTHING;
    `);
    console.log('Database initialized with schema and sample data');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

app.get('/api/auth/user', (req, res) => {
  res.json({
    id: 'container-admin',
    email: 'admin@container.local',
    firstName: 'Container',
    lastName: 'Admin'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Season Ticket Manager running' });
});

app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.get('/api/seasons', async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = 'SELECT s.*, t.name as team_name FROM seasons s LEFT JOIN teams t ON s.team_id = t.id';
    let params = [];
    
    if (teamId) {
      query += ' WHERE s.team_id = $1';
      params.push(teamId);
    }
    
    query += ' ORDER BY s.year DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

app.get('/api/games', async (req, res) => {
  try {
    const { seasonId } = req.query;
    let query = `
      SELECT g.*, s.year as season_year, t.name as team_name
      FROM games g
      LEFT JOIN seasons s ON g.season_id = s.id
      LEFT JOIN teams t ON s.team_id = t.id
    `;
    let params = [];
    
    if (seasonId) {
      query += ' WHERE g.season_id = $1';
      params.push(seasonId);
    }
    
    query += ' ORDER BY g.date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/api/ticket-holders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_holders ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket holders' });
  }
});

app.get('/api/seats', async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = `
      SELECT s.*, t.name as team_name
      FROM seats s
      LEFT JOIN teams t ON s.team_id = t.id
    `;
    let params = [];
    
    if (teamId) {
      query += ' WHERE s.team_id = $1';
      params.push(teamId);
    }
    
    query += ' ORDER BY s.section, s.row, s.number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

app.get('/api/dashboard/stats/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(gp.cost), 0) as total_revenue
      FROM game_pricing gp
      JOIN games g ON gp.game_id = g.id
      WHERE g.season_id = $1
    `, [seasonId]);
    
    const costsResult = await pool.query(`
      SELECT COALESCE(SUM(s.license_cost), 0) as total_costs
      FROM seat_ownership so
      JOIN seats s ON so.seat_id = s.id
      WHERE so.season_id = $1
    `, [seasonId]);
    
    const gameCountResult = await pool.query('SELECT COUNT(*) FROM games WHERE season_id = $1', [seasonId]);
    const seatCountResult = await pool.query('SELECT COUNT(*) FROM seat_ownership WHERE season_id = $1', [seasonId]);
    const holderCountResult = await pool.query('SELECT COUNT(DISTINCT ticket_holder_id) FROM seat_ownership WHERE season_id = $1', [seasonId]);
    
    const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue || 0);
    const totalCosts = parseFloat(costsResult.rows[0].total_costs || 0);
    const totalProfit = totalRevenue - totalCosts;
    
    const stats = {
      totalRevenue: totalRevenue.toFixed(2),
      totalCosts: totalCosts.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      gamesPlayed: 0,
      totalGames: parseInt(gameCountResult.rows[0].count),
      activeSeats: parseInt(seatCountResult.rows[0].count),
      ticketHolders: parseInt(holderCountResult.rows[0].count)
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

app.get('/api/financial-summary/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        th.id as ticket_holder_id,
        th.name,
        COUNT(so.id) as seats_owned,
        COALESCE(SUM(s.license_cost), 0)::TEXT as balance
      FROM ticket_holders th
      LEFT JOIN seat_ownership so ON th.id = so.ticket_holder_id AND so.season_id = $1
      LEFT JOIN seats s ON so.seat_id = s.id
      GROUP BY th.id, th.name
      HAVING COUNT(so.id) > 0
      ORDER BY th.name
    `, [seasonId]);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

// Static HTML fallback content
const staticHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Season Ticket Manager</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 600px;
            width: 90%;
            text-align: center;
        }
        .title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            font-size: 1.1rem;
            color: #718096;
            margin-bottom: 2rem;
        }
        .status {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 2rem;
        }
        .status-title {
            font-weight: 600;
            color: #2f855a;
            margin-bottom: 0.5rem;
        }
        .api-list {
            list-style: none;
            text-align: left;
            margin-top: 1rem;
        }
        .api-list li {
            padding: 0.5rem 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .endpoint {
            font-family: 'Monaco', 'Menlo', monospace;
            background: #f7fafc;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            color: #2d3748;
            font-size: 0.9rem;
        }
        .note {
            background: #fef5e7;
            border: 1px solid #f6d55c;
            border-radius: 8px;
            padding: 1rem;
            margin-top: 1rem;
        }
        .note-title {
            font-weight: 600;
            color: #d69e2e;
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title">Season Ticket Manager</h1>
        <p class="subtitle">49ers Season Ticket Management System</p>
        
        <div class="status">
            <div class="status-title">✅ Container Status: Running</div>
            <p>Database connected with full 49ers season ticket data</p>
        </div>
        
        <div class="note">
            <div class="note-title">React Dashboard Building</div>
            <p>Full interactive dashboard will be available once frontend compilation completes</p>
        </div>
        
        <h3>Available API Endpoints:</h3>
        <ul class="api-list">
            <li><span class="endpoint">GET /api/health</span> - System status</li>
            <li><span class="endpoint">GET /api/teams</span> - Team information</li>
            <li><span class="endpoint">GET /api/seasons</span> - Season data</li>
            <li><span class="endpoint">GET /api/games</span> - Game schedules</li>
            <li><span class="endpoint">GET /api/seats</span> - Seat information</li>
            <li><span class="endpoint">GET /api/ticket-holders</span> - Ticket holder data</li>
            <li><span class="endpoint">GET /api/dashboard/stats/1</span> - Dashboard statistics</li>
            <li><span class="endpoint">GET /api/financial-summary/1</span> - Financial summary</li>
        </ul>
        
        <script>
            setTimeout(() => {
                fetch('/api/health')
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'ok') {
                            fetch('/dashboard')
                                .then(response => {
                                    if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
                                        window.location.href = '/dashboard';
                                    }
                                })
                                .catch(() => {});
                        }
                    });
            }, 5000);
        </script>
    </div>
</body>
</html>`;

// Check for static files and serve them
const possibleDistPaths = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, '../dist'),
  path.join('/app', 'dist')
];

let distPath = null;
for (const testPath of possibleDistPaths) {
  if (fs.existsSync(testPath)) {
    distPath = testPath;
    break;
  }
}

if (distPath) {
  console.log('Found static files at:', distPath);
  app.use(express.static(distPath));
  
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send(staticHTML);
      }
    }
  });
} else {
  console.log('No static files found - serving fallback page');
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.send(staticHTML);
    }
  });
}

const PORT = process.env.PORT || 5050;

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Season Ticket Manager running on port ${PORT}`);
      console.log(`Database: Connected and initialized`);
      console.log(`Frontend: ${distPath ? 'Available' : 'Not found - API only'}`);
      console.log(`Access at: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();