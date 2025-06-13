import express from 'express';
import path from 'path';
import cors from 'cors';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
        ('49ers', 'San Francisco', 'NFL')
      ON CONFLICT DO NOTHING;

      INSERT INTO ticket_holders (name, email, phone) VALUES 
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
        (1, '119', '1', '7', 0.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO seat_ownership (seat_id, season_id, ticket_holder_id) VALUES
        (1, 1, 1), (2, 1, 1), (3, 1, 2), (4, 1, 1), (5, 1, 3), (6, 1, 3), (7, 1, 3),
        (2, 2, 1), (3, 2, 2), (4, 2, 1)
      ON CONFLICT DO NOTHING;

      INSERT INTO games (season_id, opponent, date, time, is_home) VALUES
        (1, 'Cardinals', '2024-10-12', '13:00', true),
        (1, 'Seahawks', '2024-10-20', '16:00', true),
        (1, 'Cowboys', '2024-10-27', '20:00', false),
        (1, 'Packers', '2024-11-03', '13:00', true),
        (1, 'Rams', '2024-11-10', '16:00', false)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_pricing (game_id, seat_id, cost) VALUES
        (1, 2, 450.00), (1, 3, 450.00), (1, 4, 450.00),
        (2, 2, 520.00), (2, 3, 520.00), (2, 4, 520.00),
        (3, 2, 380.00), (3, 3, 380.00), (3, 4, 380.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_attendance (ticket_holder_id, seat_id, game_id, attended) VALUES
        (1, 2, 1, true), (2, 3, 1, true), (1, 4, 1, false),
        (1, 2, 2, true), (2, 3, 2, false), (1, 4, 2, true)
      ON CONFLICT DO NOTHING;

      INSERT INTO payments (ticket_holder_id, season_id, amount, description) VALUES
        (1, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 2'),
        (1, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 4'),
        (2, 1, 9996.39, 'Seat license fee - Section 119 Row 1 Seat 3')
      ON CONFLICT DO NOTHING;

      INSERT INTO payouts (ticket_holder_id, game_id, amount, description) VALUES
        (1, 1, 450.00, 'Game attendance payout - Cardinals'),
        (2, 1, 450.00, 'Game attendance payout - Cardinals'),
        (1, 2, 520.00, 'Game attendance payout - Seahawks')
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

// Functional dashboard HTML
const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Season Ticket Manager - Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #2d3748;
        }
        .navbar {
            background: #2d3748;
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .navbar h1 { font-size: 1.5rem; }
        .navbar .user { font-size: 0.9rem; opacity: 0.8; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #4299e1;
        }
        .stat-card h3 { font-size: 0.9rem; color: #718096; margin-bottom: 0.5rem; }
        .stat-card .value { font-size: 2rem; font-weight: 700; color: #2d3748; }
        .data-section {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .data-section h2 { margin-bottom: 1rem; color: #2d3748; }
        .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f7fafc; font-weight: 600; }
        .refresh-btn {
            background: #4299e1;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 1rem;
        }
        .refresh-btn:hover { background: #3182ce; }
        .loading { text-align: center; padding: 2rem; color: #718096; }
    </style>
</head>
<body>
    <div class="navbar">
        <h1>49ers Season Ticket Manager</h1>
        <div class="user">Container Admin</div>
    </div>
    
    <div class="container">
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Revenue</h3>
                <div class="value" id="totalRevenue">Loading...</div>
            </div>
            <div class="stat-card">
                <h3>Total Costs</h3>
                <div class="value" id="totalCosts">Loading...</div>
            </div>
            <div class="stat-card">
                <h3>Total Profit</h3>
                <div class="value" id="totalProfit">Loading...</div>
            </div>
            <div class="stat-card">
                <h3>Active Seats</h3>
                <div class="value" id="activeSeats">Loading...</div>
            </div>
        </div>
        
        <div class="data-section">
            <h2>Financial Summary</h2>
            <button class="refresh-btn" onclick="loadData()">Refresh Data</button>
            <div id="financialData" class="loading">Loading financial data...</div>
        </div>
        
        <div class="data-grid">
            <div class="data-section">
                <h2>Recent Games</h2>
                <div id="gamesData" class="loading">Loading games...</div>
            </div>
            
            <div class="data-section">
                <h2>Ticket Holders</h2>
                <div id="holdersData" class="loading">Loading ticket holders...</div>
            </div>
        </div>
    </div>
    
    <script>
        async function loadData() {
            try {
                // Load dashboard stats
                const statsResponse = await fetch('/api/dashboard/stats/1');
                const stats = await statsResponse.json();
                
                document.getElementById('totalRevenue').textContent = '$' + stats.totalRevenue;
                document.getElementById('totalCosts').textContent = '$' + stats.totalCosts;
                document.getElementById('totalProfit').textContent = '$' + stats.totalProfit;
                document.getElementById('activeSeats').textContent = stats.activeSeats;
                
                // Load financial summary
                const finResponse = await fetch('/api/financial-summary/1');
                const financial = await finResponse.json();
                
                let finTable = '<table><tr><th>Name</th><th>Seats Owned</th><th>License Costs</th></tr>';
                financial.forEach(holder => {
                    finTable += \`<tr><td>\${holder.name}</td><td>\${holder.seats_owned}</td><td>$\${holder.balance}</td></tr>\`;
                });
                finTable += '</table>';
                document.getElementById('financialData').innerHTML = finTable;
                
                // Load games
                const gamesResponse = await fetch('/api/games?seasonId=1');
                const games = await gamesResponse.json();
                
                let gamesTable = '<table><tr><th>Opponent</th><th>Date</th><th>Home</th></tr>';
                games.slice(0, 5).forEach(game => {
                    gamesTable += \`<tr><td>\${game.opponent}</td><td>\${game.date}</td><td>\${game.is_home ? 'Yes' : 'No'}</td></tr>\`;
                });
                gamesTable += '</table>';
                document.getElementById('gamesData').innerHTML = gamesTable;
                
                // Load ticket holders
                const holdersResponse = await fetch('/api/ticket-holders');
                const holders = await holdersResponse.json();
                
                let holdersTable = '<table><tr><th>Name</th><th>Email</th></tr>';
                holders.forEach(holder => {
                    holdersTable += \`<tr><td>\${holder.name}</td><td>\${holder.email || 'N/A'}</td></tr>\`;
                });
                holdersTable += '</table>';
                document.getElementById('holdersData').innerHTML = holdersTable;
                
            } catch (error) {
                console.error('Error loading data:', error);
                document.getElementById('financialData').innerHTML = 'Error loading data';
            }
        }
        
        // Load data on page load
        loadData();
        
        // Auto-refresh every 30 seconds
        setInterval(loadData, 30000);
    </script>
</body>
</html>`;

app.get('/dashboard', (req, res) => {
  res.send(dashboardHTML);
});

app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.redirect('/dashboard');
  }
});

const PORT = process.env.PORT || 5050;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Season Ticket Manager running on port ${PORT}`);
      console.log(`Database: Connected with complete schema`);
      console.log(`Dashboard: Available at http://localhost:${PORT}/dashboard`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();