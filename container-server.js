const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:ticketpass123@postgres:5432/ticket_management'
});

// Initialize database with full schema
async function initDatabase() {
  try {
    await pool.query(`
      -- Create all required tables
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

      CREATE TABLE IF NOT EXISTS team_performance (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        season_id INTEGER REFERENCES seasons(id),
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        win_percentage DECIMAL(5,3) DEFAULT 0,
        playoff_probability DECIMAL(5,3) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        last_updated TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS seat_value_predictions (
        id SERIAL PRIMARY KEY,
        seat_id INTEGER REFERENCES seats(id),
        season_id INTEGER REFERENCES seasons(id),
        predicted_value DECIMAL(10,2) NOT NULL,
        confidence_score DECIMAL(5,3) DEFAULT 0,
        calculated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Insert sample data for immediate use
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
        (1, 1, 2),
        (2, 1, 2),
        (3, 1, 3),
        (4, 1, 2),
        (5, 1, 4),
        (6, 1, 4),
        (7, 1, 4),
        (2, 2, 2),
        (3, 2, 3),
        (4, 2, 2)
      ON CONFLICT DO NOTHING;

      INSERT INTO games (season_id, opponent, date, time, is_home) VALUES
        (1, 'Cardinals', '2024-10-12', '13:00', true),
        (1, 'Seahawks', '2024-10-20', '16:00', true),
        (1, 'Cowboys', '2024-10-27', '20:00', false),
        (2, 'Rams', '2025-09-15', '13:00', true),
        (2, 'Packers', '2025-09-22', '16:00', true)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_pricing (game_id, seat_id, cost) VALUES
        (1, 2, 450.00),
        (1, 3, 450.00),
        (1, 4, 450.00),
        (2, 2, 520.00),
        (2, 3, 520.00),
        (2, 4, 520.00),
        (3, 2, 380.00),
        (3, 3, 380.00),
        (3, 4, 380.00)
      ON CONFLICT DO NOTHING;

      INSERT INTO game_attendance (ticket_holder_id, seat_id, game_id, attended) VALUES
        (2, 2, 1, true),
        (3, 3, 1, true),
        (2, 4, 1, false),
        (2, 2, 2, true),
        (3, 3, 2, false),
        (2, 4, 2, true)
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
    console.log('Database initialized with full schema and sample data');
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
    id: 'container-admin',
    email: 'admin@container.local',
    firstName: 'Container',
    lastName: 'Admin'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Full application with database backend' });
});

// Teams API
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

// Seasons API
app.get('/api/seasons', async (req, res) => {
  try {
    const { teamId } = req.query;
    let query = `
      SELECT s.*, t.name as team_name 
      FROM seasons s 
      LEFT JOIN teams t ON s.team_id = t.id 
    `;
    let params = [];
    
    if (teamId) {
      query += ' WHERE s.team_id = $1';
      params.push(teamId);
    }
    
    query += ' ORDER BY s.year DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

app.post('/api/seasons', async (req, res) => {
  try {
    const { teamId, year, name, startDate, endDate } = req.body;
    const result = await pool.query(
      'INSERT INTO seasons (team_id, year, name, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [teamId, year, name, startDate, endDate]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating season:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

// Games API
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
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

app.post('/api/games', async (req, res) => {
  try {
    const { seasonId, opponent, date, time, isHome, isPlayoff } = req.body;
    const result = await pool.query(
      'INSERT INTO games (season_id, opponent, date, time, is_home, is_playoff) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [seasonId, opponent, date, time, isHome, isPlayoff]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Ticket holders API
app.get('/api/ticket-holders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_holders ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching ticket holders:', error);
    res.status(500).json({ error: 'Failed to fetch ticket holders' });
  }
});

app.post('/api/ticket-holders', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const result = await pool.query(
      'INSERT INTO ticket_holders (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ticket holder:', error);
    res.status(500).json({ error: 'Failed to create ticket holder' });
  }
});

// Seats API
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
    console.error('Error fetching seats:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

app.post('/api/seats', async (req, res) => {
  try {
    const { teamId, section, row, number, licenseCost } = req.body;
    const result = await pool.query(
      'INSERT INTO seats (team_id, section, row, number, license_cost) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [teamId, section, row, number, licenseCost]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating seat:', error);
    res.status(500).json({ error: 'Failed to create seat' });
  }
});

// Seat ownership API
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
    console.error('Error fetching seat ownership:', error);
    res.status(500).json({ error: 'Failed to fetch seat ownership' });
  }
});

app.post('/api/seat-ownership', async (req, res) => {
  try {
    const { seatId, seasonId, ticketHolderId } = req.body;
    const result = await pool.query(
      'INSERT INTO seat_ownership (seat_id, season_id, ticket_holder_id) VALUES ($1, $2, $3) RETURNING *',
      [seatId, seasonId, ticketHolderId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating seat ownership:', error);
    res.status(500).json({ error: 'Failed to create seat ownership' });
  }
});

// Payments API
app.get('/api/payments', async (req, res) => {
  try {
    const { seasonId } = req.query;
    let query = `
      SELECT p.*, th.name as ticket_holder_name, s.year as season_year, t.name as team_name
      FROM payments p
      LEFT JOIN ticket_holders th ON p.ticket_holder_id = th.id
      LEFT JOIN seasons s ON p.season_id = s.id
      LEFT JOIN teams t ON s.team_id = t.id
    `;
    let params = [];
    
    if (seasonId) {
      query += ' WHERE p.season_id = $1';
      params.push(seasonId);
    }
    
    query += ' ORDER BY p.payment_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Payouts API
app.get('/api/payouts', async (req, res) => {
  try {
    const { gameId, ticketHolderId } = req.query;
    let query = `
      SELECT p.*, th.name as ticket_holder_name, g.opponent, g.date as game_date
      FROM payouts p
      LEFT JOIN ticket_holders th ON p.ticket_holder_id = th.id
      LEFT JOIN games g ON p.game_id = g.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;
    
    if (gameId) {
      paramCount++;
      query += ` AND p.game_id = $${paramCount}`;
      params.push(gameId);
    }
    
    if (ticketHolderId) {
      paramCount++;
      query += ` AND p.ticket_holder_id = $${paramCount}`;
      params.push(ticketHolderId);
    }
    
    query += ' ORDER BY p.payout_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

// Game pricing API
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
    console.error('Error fetching game pricing:', error);
    res.status(500).json({ error: 'Failed to fetch game pricing' });
  }
});

// Game attendance API
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
    console.error('Error fetching game attendance:', error);
    res.status(500).json({ error: 'Failed to fetch game attendance' });
  }
});

// Transfers API
app.get('/api/transfers', async (req, res) => {
  try {
    const { gameId } = req.query;
    let query = `
      SELECT t.*, g.opponent, g.date, 
             from_th.name as from_ticket_holder_name,
             to_th.name as to_ticket_holder_name,
             s.section, s.row, s.number
      FROM transfers t
      LEFT JOIN games g ON t.game_id = g.id
      LEFT JOIN ticket_holders from_th ON t.from_ticket_holder_id = from_th.id
      LEFT JOIN ticket_holders to_th ON t.to_ticket_holder_id = to_th.id
      LEFT JOIN seats s ON t.seat_id = s.id
    `;
    let params = [];
    
    if (gameId) {
      query += ' WHERE t.game_id = $1';
      params.push(gameId);
    }
    
    query += ' ORDER BY t.transfer_date DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// Dashboard stats API
app.get('/api/dashboard/stats/:seasonId', async (req, res) => {
  try {
    const { seasonId } = req.params;
    
    // Calculate total revenue from game pricing
    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(gp.cost), 0) as total_revenue
      FROM game_pricing gp
      JOIN games g ON gp.game_id = g.id
      WHERE g.season_id = $1
    `, [seasonId]);
    
    // Calculate total costs from seat licenses
    const costsResult = await pool.query(`
      SELECT COALESCE(SUM(s.license_cost), 0) as total_costs
      FROM seat_ownership so
      JOIN seats s ON so.seat_id = s.id
      WHERE so.season_id = $1
    `, [seasonId]);
    
    // Game counts
    const gameCountResult = await pool.query('SELECT COUNT(*) FROM games WHERE season_id = $1', [seasonId]);
    
    // Seat and ticket holder counts
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
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Financial summary API
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
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ error: 'Failed to fetch financial summary' });
  }
});

// Team performance API
app.get('/api/team-performance', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT tp.*, t.name as team_name, s.year as season_year
      FROM team_performance tp
      LEFT JOIN teams t ON tp.team_id = t.id
      LEFT JOIN seasons s ON tp.season_id = s.id
      ORDER BY s.year DESC, t.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching team performance:', error);
    res.status(500).json({ error: 'Failed to fetch team performance' });
  }
});

// Seat value predictions API
app.get('/api/seat-value-predictions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT svp.*, s.section, s.row, s.number, se.year as season_year
      FROM seat_value_predictions svp
      LEFT JOIN seats s ON svp.seat_id = s.id
      LEFT JOIN seasons se ON svp.season_id = se.id
      ORDER BY svp.predicted_value DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching seat value predictions:', error);
    res.status(500).json({ error: 'Failed to fetch seat value predictions' });
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
      console.error('Error serving frontend:', err);
      res.status(500).send('Application frontend not available');
    }
  });
});

const port = 5000;
app.listen(port, '0.0.0.0', async () => {
  console.log(`Full ticket management application running on port ${port}`);
  console.log(`Access at http://your-nas-ip:8080`);
  await initDatabase();
});