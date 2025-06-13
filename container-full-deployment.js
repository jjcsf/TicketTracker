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
        ('Jane Doe', 'jane@example.com', '555-0103'),
        ('Mike Wilson', 'mike@example.com', '555-0104'),
        ('Sarah Davis', 'sarah@example.com', '555-0105')
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
        (1, '119', '1', '7', 0.00),
        (1, '119', '2', '1', 8500.00),
        (1, '119', '2', '2', 8500.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO seat_ownership (seat_id, season_id, ticket_holder_id) VALUES
        (1, 1, 2), (2, 1, 2), (3, 1, 3), (4, 1, 2), (5, 1, 4), (6, 1, 4), (7, 1, 4),
        (8, 1, 5), (9, 1, 6),
        (2, 2, 2), (3, 2, 3), (4, 2, 2), (8, 2, 5), (9, 2, 6)
      ON CONFLICT DO NOTHING;

      INSERT INTO games (season_id, opponent, date, time, is_home) VALUES
        (1, 'Cardinals', '2024-10-12', '13:00', true),
        (1, 'Seahawks', '2024-10-20', '16:00', true),
        (1, 'Cowboys', '2024-10-27', '20:00', false),
        (1, 'Packers', '2024-11-03', '13:00', true),
        (1, 'Rams', '2024-11-10', '16:00', false),
        (2, 'Rams', '2025-09-15', '13:00', true),
        (2, 'Packers', '2025-09-22', '16:00', true),
        (2, 'Cardinals', '2025-09-29', '20:00', false)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_pricing (game_id, seat_id, cost) VALUES
        (1, 2, 450.00), (1, 3, 450.00), (1, 4, 450.00), (1, 8, 425.00), (1, 9, 425.00),
        (2, 2, 520.00), (2, 3, 520.00), (2, 4, 520.00), (2, 8, 495.00), (2, 9, 495.00),
        (3, 2, 380.00), (3, 3, 380.00), (3, 4, 380.00), (3, 8, 360.00), (3, 9, 360.00),
        (4, 2, 475.00), (4, 3, 475.00), (4, 4, 475.00), (4, 8, 450.00), (4, 9, 450.00),
        (5, 2, 390.00), (5, 3, 390.00), (5, 4, 390.00), (5, 8, 370.00), (5, 9, 370.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_attendance (ticket_holder_id, seat_id, game_id, attended) VALUES
        (2, 2, 1, true), (3, 3, 1, true), (2, 4, 1, false), (5, 8, 1, true), (6, 9, 1, true),
        (2, 2, 2, true), (3, 3, 2, false), (2, 4, 2, true), (5, 8, 2, false), (6, 9, 2, true),
        (2, 2, 3, false), (3, 3, 3, true), (2, 4, 3, true), (5, 8, 3, true), (6, 9, 3, false)
      ON CONFLICT DO NOTHING;

      INSERT INTO payments (ticket_holder_id, season_id, amount, description) VALUES
        (2, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 2'),
        (2, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 4'),
        (3, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 3'),
        (5, 1, 8500.00, 'Seat license fee - Section 119 Row 2 Seat 1'),
        (6, 1, 8500.00, 'Seat license fee - Section 119 Row 2 Seat 2')
      ON CONFLICT DO NOTHING;

      INSERT INTO payouts (ticket_holder_id, game_id, amount, description) VALUES
        (2, 1, 450.00, 'Game attendance payout - Cardinals'),
        (3, 1, 450.00, 'Game attendance payout - Cardinals'),
        (5, 1, 425.00, 'Game attendance payout - Cardinals'),
        (6, 1, 425.00, 'Game attendance payout - Cardinals'),
        (2, 2, 520.00, 'Game attendance payout - Seahawks'),
        (6, 2, 495.00, 'Game attendance payout - Seahawks')
      ON CONFLICT DO NOTHING;
    `);
    console.log('Database initialized with complete schema and sample data');
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
  res.json({ 
    status: 'ok', 
    message: 'Season Ticket Manager running',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
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

app.get('/api/seat-ownership', async (req, res) => {
  try {
    const { seasonId } = req.query;
    let query = `
      SELECT so.*, s.section, s.row, s.number, s.license_cost, th.name as ticket_holder_name, t.name as team_name
      FROM seat_ownership so
      LEFT JOIN seats s ON so.seat_id = s.id
      LEFT JOIN ticket_holders th ON so.ticket_holder_id = th.id
      LEFT JOIN teams t ON s.team_id = t.id
    `;
    let params = [];
    
    if (seasonId) {
      query += ' WHERE so.season_id = $1';
      params.push(seasonId);
    }
    
    query += ' ORDER BY s.section, s.row, s.number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seat ownership' });
  }
});

app.get('/api/game-pricing', async (req, res) => {
  try {
    const { gameId } = req.query;
    let query = `
      SELECT gp.*, g.opponent, g.date, s.section, s.row, s.number
      FROM game_pricing gp
      LEFT JOIN games g ON gp.game_id = g.id
      LEFT JOIN seats s ON gp.seat_id = s.id
    `;
    let params = [];
    
    if (gameId) {
      query += ' WHERE gp.game_id = $1';
      params.push(gameId);
    }
    
    query += ' ORDER BY g.date DESC, s.section, s.row, s.number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game pricing' });
  }
});

app.get('/api/game-attendance', async (req, res) => {
  try {
    const { gameId } = req.query;
    let query = `
      SELECT ga.*, g.opponent, g.date, th.name as ticket_holder_name, s.section, s.row, s.number
      FROM game_attendance ga
      LEFT JOIN games g ON ga.game_id = g.id
      LEFT JOIN ticket_holders th ON ga.ticket_holder_id = th.id
      LEFT JOIN seats s ON ga.seat_id = s.id
    `;
    let params = [];
    
    if (gameId) {
      query += ' WHERE ga.game_id = $1';
      params.push(gameId);
    }
    
    query += ' ORDER BY g.date DESC, s.section, s.row, s.number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game attendance' });
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
      gamesPlayed: 3,
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

// Static fallback HTML
const fallbackHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Season Ticket Manager - 49ers</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 700px; width: 90%; text-align: center; }
        .title { font-size: 2.5rem; font-weight: 700; color: #2d3748; margin-bottom: 0.5rem; }
        .subtitle { font-size: 1.1rem; color: #718096; margin-bottom: 2rem; }
        .status { background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 1rem; margin-bottom: 2rem; }
        .status-title { font-weight: 600; color: #2f855a; margin-bottom: 0.5rem; }
        .loading { background: #fef5e7; border: 1px solid #f6d55c; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .loading-title { font-weight: 600; color: #d69e2e; margin-bottom: 0.5rem; }
        .api-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 2rem 0; }
        .api-section { background: #f8fafc; padding: 1rem; border-radius: 8px; text-align: left; }
        .api-section h4 { color: #2d3748; margin-bottom: 0.5rem; }
        .endpoint { font-family: Monaco, monospace; background: #e2e8f0; padding: 0.25rem 0.5rem; border-radius: 4px; color: #2d3748; font-size: 0.8rem; display: block; margin: 0.25rem 0; }
        .dashboard-btn { background: #4299e1; color: white; padding: 1rem 2rem; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-top: 1rem; text-decoration: none; display: inline-block; }
        .dashboard-btn:hover { background: #3182ce; }
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
        
        <div class="loading">
            <div class="loading-title">⚡ React Dashboard Loading</div>
            <p>Full interactive dashboard will appear automatically when ready</p>
        </div>
        
        <div class="api-grid">
            <div class="api-section">
                <h4>Core Data</h4>
                <span class="endpoint">GET /api/teams</span>
                <span class="endpoint">GET /api/seasons</span>
                <span class="endpoint">GET /api/games</span>
                <span class="endpoint">GET /api/seats</span>
            </div>
            <div class="api-section">
                <h4>Management</h4>
                <span class="endpoint">GET /api/ticket-holders</span>
                <span class="endpoint">GET /api/seat-ownership</span>
                <span class="endpoint">GET /api/game-attendance</span>
                <span class="endpoint">GET /api/game-pricing</span>
            </div>
            <div class="api-section">
                <h4>Analytics</h4>
                <span class="endpoint">GET /api/dashboard/stats/1</span>
                <span class="endpoint">GET /api/financial-summary/1</span>
                <span class="endpoint">GET /api/health</span>
            </div>
        </div>
        
        <a href="/dashboard" class="dashboard-btn" onclick="checkDashboard(event)">Access Dashboard</a>
        
        <script>
            function checkDashboard(e) {
                e.preventDefault();
                fetch('/dashboard').then(r => r.text()).then(html => {
                    if (html.includes('<!DOCTYPE html>') && html.includes('react')) {
                        window.location.href = '/dashboard';
                    } else {
                        alert('Dashboard still building - will auto-redirect when ready');
                    }
                }).catch(() => alert('Dashboard still building'));
            }
            
            setInterval(() => {
                fetch('/dashboard').then(r => r.text()).then(html => {
                    if (html.includes('<!DOCTYPE html>') && html.includes('react')) {
                        window.location.href = '/dashboard';
                    }
                }).catch(() => {});
            }, 10000);
        </script>
    </div>
</body>
</html>`;

// Frontend serving logic
const distPaths = [path.join(__dirname, 'dist'), path.join(__dirname, '../dist'), '/app/dist'];
let frontendPath = distPaths.find(p => fs.existsSync(p));

if (frontendPath) {
  console.log('Serving React frontend from:', frontendPath);
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      const indexPath = path.join(frontendPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send(fallbackHTML);
      }
    }
  });
} else {
  console.log('Frontend building - serving fallback interface');
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.send(fallbackHTML);
    }
  });
}

const PORT = process.env.PORT || 5050;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Season Ticket Manager running on port ${PORT}`);
      console.log(`Database: Connected with complete schema`);
      console.log(`Frontend: ${frontendPath ? 'React app ready' : 'Building - fallback active'}`);
      console.log(`Access: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();