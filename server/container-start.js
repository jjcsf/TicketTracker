<<<<<<< HEAD
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const app = express();
const port = process.env.PORT || 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

  await initDatabase();
  console.log('Application ready!');
});
=======
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Database connection with retry logic
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ticketpass123@postgres:5432/ticket_management',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database with full schema
async function initDatabase() {
  let retries = 5;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('Database connection established');
      break;
    } catch (error) {
      console.log(`Database connection failed, retrying... (${retries} attempts left)`);
      retries--;
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  try {
    await pool.query(`
      -- Create all tables
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

      -- Insert sample data
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
    console.log('Database schema and sample data initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Authentication bypass for container
app.get('/api/auth/user', (req, res) => {
  res.json({
    id: 'container-admin',
    email: 'admin@container.local',
    firstName: 'Container',
    lastName: 'Admin'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Container application running with database' });
});

// Complete API implementation
const createApiEndpoint = (tableName, fields) => {
  app.get(`/api/${tableName}`, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
      res.json(result.rows);
    } catch (error) {
      console.error(`Error fetching ${tableName}:`, error);
      res.status(500).json({ error: `Failed to fetch ${tableName}` });
    }
  });
};

// Teams
app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Seasons
app.get('/api/seasons', async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = `SELECT s.*, t.name as team_name FROM seasons s LEFT JOIN teams t ON s.team_id = t.id`;
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

// Games
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

// Ticket holders
app.get('/api/ticket-holders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_holders ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ticket holders' });
  }
});

// Seats
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

// Seat ownership
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

// Game pricing
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

// Game attendance
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

// Transfers
app.get('/api/transfers', async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// Dashboard stats
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

// Financial summary
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

// Serve the built React application
const clientDistPath = path.resolve('client/dist');
console.log('Serving static files from:', clientDistPath);

// Check if dist directory exists
const fs = require('fs');
if (!fs.existsSync(clientDistPath)) {
  console.error('Client dist directory not found at:', clientDistPath);
  console.log('Available directories:', fs.readdirSync(path.resolve('.')));
}

app.use(express.static(clientDistPath));

// SPA catch-all route
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send(`
        <html>
          <head><title>Application Error</title></head>
          <body>
            <h1>Application Build Error</h1>
            <p>The React application was not built properly.</p>
            <p>Error: ${err.message}</p>
            <p>Looking for: ${indexPath}</p>
          </body>
        </html>
      `);
    }
  });
});

const port = 5000;
app.listen(port, '0.0.0.0', async () => {
  console.log(`Container application running on port ${port}`);
  console.log(`Access the application at http://your-nas-ip:8080`);
  console.log('Initializing database...');
  await initDatabase();
  console.log('Application ready!');
});
>>>>>>> 21aa58d (Initial commit)
