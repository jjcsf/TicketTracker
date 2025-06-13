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
        game_id INTEGER REFERENCES games(id),
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        amount DECIMAL(10,2) NOT NULL,
        payout_date DATE DEFAULT CURRENT_DATE,
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

      CREATE TABLE IF NOT EXISTS game_attendance (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        seat_id INTEGER REFERENCES seats(id),
        attended BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_pricing (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games(id),
        seat_id INTEGER REFERENCES seats(id),
        cost DECIMAL(10,2) NOT NULL,
        sold BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS team_performance (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        season_id INTEGER REFERENCES seasons(id),
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        win_percentage DECIMAL(5,2),
        avg_attendance INTEGER,
        total_revenue DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seat_value_predictions (
        id SERIAL PRIMARY KEY,
        seat_id INTEGER REFERENCES seats(id),
        season_id INTEGER REFERENCES seasons(id),
        predicted_value DECIMAL(10,2),
        confidence_score DECIMAL(5,2),
        factors JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert sample data if tables are empty
    const teamCount = await pool.query('SELECT COUNT(*) FROM teams');
    if (parseInt(teamCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO teams (id, name, city, league) VALUES 
        (1, '49ers', 'San Francisco', 'NFL'),
        (2, '49ers', 'San Francisco', 'NFL');

        INSERT INTO seasons (id, team_id, year, name, start_date, end_date) VALUES 
        (1, 1, 2024, '2024 Season', '2024-09-01', '2025-02-28'),
        (2, 2, 2025, '2025 Season', '2025-09-01', '2026-02-28'),
        (3, 2, 2024, '2024 Season', '2024-09-01', '2025-02-28'),
        (4, 2, 2023, '2023 Season', '2023-09-01', '2024-02-28');

        INSERT INTO ticket_holders (id, name, email, phone) VALUES 
        (1, 'Cale', 'cale.john@gmail.com', '555-0001'),
        (2, 'Jane Doe', 'jane@example.com', '555-0002'),
        (3, 'John Smith', 'john@example.com', '555-0003'),
        (4, 'Mike Wilson', 'mike@example.com', '555-0004');

        INSERT INTO seats (id, team_id, section, row, number, license_cost) VALUES 
        (1, 2, '119', '1', '1', 0.00),
        (2, 2, '119', '1', '2', 9996.39),
        (3, 2, '119', '1', '3', 9996.39),
        (4, 2, '119', '1', '4', 9996.39),
        (5, 2, '119', '1', '5', 0.00),
        (6, 2, '119', '1', '6', 0.00),
        (7, 2, '119', '1', '7', 0.00);

        INSERT INTO seat_ownership (seat_id, season_id, ticket_holder_id) VALUES 
        (2, 2, 1),
        (3, 2, 2),
        (4, 2, 3);

        INSERT INTO games (id, season_id, opponent, date, time, is_home, is_playoff) VALUES 
        (99, 2, 'Rams', '2024-11-01', '13:00', true, false),
        (131, 2, 'Rams', '2024-10-12', '20:15', false, false),
        (197, 4, 'Cowboys', '2023-10-08', '20:20', false, false);

        INSERT INTO game_pricing (id, game_id, seat_id, cost, sold) VALUES 
        (61, 99, 2, 135.15, true),
        (62, 131, 2, 150.00, true),
        (63, 197, 2, 200.00, false);

        INSERT INTO game_attendance (id, game_id, ticket_holder_id, seat_id, attended) VALUES 
        (2, 99, 1, 2, true),
        (3, 131, 1, 2, false);
      `);
    }

    console.log('Database initialized with sample data');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Serve static files from dist directory (built React app)
const distPath = path.join(__dirname, 'dist');
console.log('Looking for built React app at:', distPath);

if (fs.existsSync(distPath)) {
  console.log('Found dist directory - serving React app');
  app.use(express.static(distPath));
} else {
  console.log('No dist directory found - React app not built');
}

// API Routes
app.get('/api/auth/user', (req, res) => {
  // Bypass auth for container deployment
  res.json({
    id: '1',
    email: 'container@admin.local',
    firstName: 'Container',
    lastName: 'Admin'
  });
});

app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.get('/api/seasons', async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = 'SELECT * FROM seasons';
    let params = [];
    
    if (teamId) {
      query += ' WHERE team_id = $1';
      params = [teamId];
    }
    
    query += ' ORDER BY year DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

app.get('/api/games', async (req, res) => {
  try {
    const { seasonId } = req.query;
    let query = 'SELECT * FROM games';
    let params = [];
    
    if (seasonId) {
      query += ' WHERE season_id = $1';
      params = [seasonId];
    }
    
    query += ' ORDER BY date DESC';
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
    let query = 'SELECT * FROM seats';
    let params = [];
    
    if (teamId) {
      query += ' WHERE team_id = $1';
      params = [teamId];
    }
    
    query += ' ORDER BY section, row, number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

app.get('/api/seat-ownership', async (req, res) => {
  try {
    const { seasonId } = req.query;
    let query = 'SELECT * FROM seat_ownership';
    let params = [];
    
    if (seasonId) {
      query += ' WHERE season_id = $1';
      params = [seasonId];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seat ownership' });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const { seasonId } = req.query;
    let query = `
      SELECT p.*, th.name as ticket_holder_name, t.name as team_name 
      FROM payments p
      LEFT JOIN ticket_holders th ON p.ticket_holder_id = th.id
      LEFT JOIN seasons s ON p.season_id = s.id
      LEFT JOIN teams t ON s.team_id = t.id
    `;
    let params = [];
    
    if (seasonId) {
      query += ' WHERE p.season_id = $1';
      params = [seasonId];
    }
    
    query += ' ORDER BY p.payment_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.get('/api/transfers', async (req, res) => {
  try {
    const { gameId } = req.query;
    let query = 'SELECT * FROM transfers';
    let params = [];
    
    if (gameId) {
      query += ' WHERE game_id = $1';
      params = [gameId];
    }
    
    query += ' ORDER BY transfer_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

app.get('/api/game-attendance', async (req, res) => {
  try {
    const { gameId } = req.query;
    let query = 'SELECT * FROM game_attendance';
    let params = [];
    
    if (gameId) {
      query += ' WHERE game_id = $1';
      params = [gameId];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game attendance' });
  }
});

app.get('/api/game-pricing', async (req, res) => {
  try {
    const { gameId } = req.query;
    let query = 'SELECT * FROM game_pricing';
    let params = [];
    
    if (gameId) {
      query += ' WHERE game_id = $1';
      params = [gameId];
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game pricing' });
  }
});

app.get('/api/dashboard/stats/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(gp.cost), 0) as total_revenue
      FROM game_pricing gp
      JOIN games g ON gp.game_id = g.id
      WHERE g.season_id = $1 AND gp.sold = true
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

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('React app not found. Please build the frontend first.');
  }
});

const PORT = process.env.PORT || 5050;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Season Ticket Manager running on port ${PORT}`);
      console.log(`React app: ${fs.existsSync(distPath) ? 'Available' : 'Not found - build required'}`);
      console.log(`Database: Connected with complete schema`);
    });
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

startServer();