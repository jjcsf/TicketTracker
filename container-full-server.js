const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ticketpass123@postgres:5432/ticket_management'
});

// Initialize database tables
async function initDatabase() {
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
        game_date DATE NOT NULL,
        game_time TIME,
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

      INSERT INTO teams (name, city, league) VALUES 
        ('Sample Team', 'Sample City', 'Sample League')
      ON CONFLICT DO NOTHING;

      INSERT INTO ticket_holders (name, email) VALUES 
        ('John Smith', 'john@example.com'),
        ('Jane Doe', 'jane@example.com')
      ON CONFLICT DO NOTHING;
    `);
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Logging middleware
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

// Authentication bypass for container deployment
app.get('/api/auth/user', (req, res) => {
  res.json({
    id: 'container-user',
    email: 'admin@container.local',
    firstName: 'Container',
    lastName: 'Admin'
  });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Container deployment with database connection' });
});

app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const { name, city, league } = req.body;
    const result = await pool.query(
      'INSERT INTO teams (name, city, league) VALUES ($1, $2, $3) RETURNING *',
      [name, city, league]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

app.get('/api/seasons', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, t.name as team_name 
      FROM seasons s 
      LEFT JOIN teams t ON s.team_id = t.id 
      ORDER BY s.year DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

app.get('/api/games', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, s.year as season_year, t.name as team_name
      FROM games g
      LEFT JOIN seasons s ON g.season_id = s.id
      LEFT JOIN teams t ON s.team_id = t.id
      ORDER BY g.game_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.get('/api/ticket-holders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_holders ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ticket holders:', error);
    res.status(500).json({ error: 'Failed to fetch ticket holders' });
  }
});

app.get('/api/seats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, t.name as team_name
      FROM seats s
      LEFT JOIN teams t ON s.team_id = t.id
      ORDER BY s.section, s.row, s.number
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching seats:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// Dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = {
      totalTeams: 0,
      totalSeasons: 0,
      totalGames: 0,
      totalTicketHolders: 0
    };

    const teamCount = await pool.query('SELECT COUNT(*) FROM teams');
    const seasonCount = await pool.query('SELECT COUNT(*) FROM seasons');
    const gameCount = await pool.query('SELECT COUNT(*) FROM games');
    const holderCount = await pool.query('SELECT COUNT(*) FROM ticket_holders');

    stats.totalTeams = parseInt(teamCount.rows[0].count);
    stats.totalSeasons = parseInt(seasonCount.rows[0].count);
    stats.totalGames = parseInt(gameCount.rows[0].count);
    stats.totalTicketHolders = parseInt(holderCount.rows[0].count);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Serve static files
const clientDistPath = path.resolve('client/dist');
app.use(express.static(clientDistPath));

// SPA catch-all
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(500).send('Frontend build not found. Check build process.');
    }
  });
});

const port = 5000;
app.listen(port, '0.0.0.0', async () => {
  console.log(`Container server running on port ${port}`);
  console.log(`Access application at http://your-nas-ip:8080`);
  
  // Initialize database on startup
  await initDatabase();
});