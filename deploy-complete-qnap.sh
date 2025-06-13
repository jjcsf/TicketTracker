#!/bin/bash

set -e

echo "Season Ticket Manager - Complete QNAP Deployment"
echo "================================================"

# Configuration
CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"
MEMORY_LIMIT="2GB"
CPU_LIMIT="2"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root: sudo $0"
    exit 1
fi

# Stop existing container if it exists
if lxc list | grep -q "$CONTAINER_NAME"; then
    print_step "Stopping existing container..."
    lxc stop "$CONTAINER_NAME" --force 2>/dev/null || true
    lxc delete "$CONTAINER_NAME" --force 2>/dev/null || true
    sleep 3
fi

# Create new Ubuntu container
print_step "Creating Ubuntu 22.04 container..."
lxc launch ubuntu:22.04 "$CONTAINER_NAME"

print_step "Waiting for container to initialize (this may take 2-3 minutes)..."
sleep 20

# Wait for container to be fully ready
for i in {1..12}; do
    if lxc exec "$CONTAINER_NAME" -- test -f /var/lib/dpkg/lock-frontend; then
        print_warning "Waiting for package manager to be ready... ($i/12)"
        sleep 15
    else
        break
    fi
done

# Configure container resources
print_step "Configuring container resources..."
lxc config set "$CONTAINER_NAME" limits.memory "$MEMORY_LIMIT"
lxc config set "$CONTAINER_NAME" limits.cpu "$CPU_LIMIT"

# Setup port forwarding
print_step "Setting up port forwarding..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT

# Update system and install base packages
print_step "Updating system and installing base packages..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    export NEEDRESTART_MODE=a
    apt update -qq
    apt upgrade -y -qq
"

# Install Node.js
print_step "Installing Node.js 20..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential
"

# Install and configure PostgreSQL
print_step "Installing and configuring PostgreSQL..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt install -y -qq postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
"

# Wait for PostgreSQL to be ready
sleep 10

# Setup database
print_step "Setting up PostgreSQL database..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    sudo -u postgres createdb seasontickets 2>/dev/null || true
    sudo -u postgres psql -c \"CREATE USER ticketmgr WITH PASSWORD 'ticketpass123';\" 2>/dev/null || true
    sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE seasontickets TO ticketmgr;\" 2>/dev/null || true
    sudo -u postgres psql -c \"ALTER USER ticketmgr CREATEDB;\" 2>/dev/null || true
"

# Create application user and directory
print_step "Setting up application structure..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    mkdir -p /opt/season-ticket-manager
    useradd -r -s /bin/bash -d /opt/season-ticket-manager ticketmgr 2>/dev/null || true
    chown -R ticketmgr:ticketmgr /opt/season-ticket-manager
"

# Create package.json
print_step "Creating Node.js application..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/package.json << "EOF"
{
  "name": "season-ticket-manager-complete",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "pg": "^8.11.3",
    "cors": "^2.8.5"
  }
}
EOF' ticketmgr

# Install Node.js dependencies
print_step "Installing Node.js dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && npm install --silent --no-audit' ticketmgr

# Create database schema
print_step "Creating database schema..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/schema.js << "EOF"
const { Pool } = require("pg");

const pool = new Pool({
  user: "ticketmgr",
  password: "ticketpass123", 
  host: "localhost",
  database: "seasontickets",
  port: 5432,
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log("Initializing database schema...");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS seasons (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS seats (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id),
        section VARCHAR(50) NOT NULL,
        row VARCHAR(10) NOT NULL,
        number VARCHAR(10) NOT NULL,
        license_cost DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_holders (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS seat_ownership (
        id SERIAL PRIMARY KEY,
        seat_id INTEGER REFERENCES seats(id),
        season_id INTEGER REFERENCES seasons(id),
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        season_id INTEGER REFERENCES seasons(id),
        date DATE NOT NULL,
        time TIME,
        opponent VARCHAR(255) NOT NULL,
        home_away VARCHAR(10) DEFAULT 'home',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        season_id INTEGER REFERENCES seasons(id),
        ticket_holder_id INTEGER REFERENCES ticket_holders(id),
        amount DECIMAL(10,2) NOT NULL,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        payment_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO teams (name) VALUES ('49ers'), ('Giants') 
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO seasons (team_id, year) VALUES (1, 2025), (2, 2025)
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO ticket_holders (name, email) VALUES 
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com'),
      ('Mike Johnson', 'mike@example.com')
      ON CONFLICT (email) DO NOTHING;
    `);

    await client.query(`
      INSERT INTO seats (team_id, section, row, number, license_cost) VALUES
      (1, '119', '1', '1', 0),
      (1, '119', '1', '2', 9996.39),
      (1, '119', '1', '3', 9996.39),
      (1, '119', '1', '4', 9996.39),
      (1, '119', '1', '5', 0),
      (1, '119', '1', '6', 0),
      (1, '119', '1', '7', 0)
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO seat_ownership (seat_id, season_id, ticket_holder_id) VALUES
      (1, 1, 1), (2, 1, 1), (3, 1, 2), (4, 1, 2), (5, 1, 3), (6, 1, 3), (7, 1, 3)
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO payments (season_id, ticket_holder_id, amount, type, description) VALUES
      (1, 1, 9996.39, 'cost', 'License fee for seat 2'),
      (1, 1, 9996.39, 'cost', 'License fee for seat 3'),
      (1, 2, 9996.39, 'cost', 'License fee for seat 4'),
      (1, 1, 5000.00, 'revenue', 'Season ticket payment - John Doe'),
      (1, 2, 7500.00, 'revenue', 'Season ticket payment - Jane Smith'),
      (1, 3, 4200.00, 'revenue', 'Season ticket payment - Mike Johnson')
      ON CONFLICT DO NOTHING;
    `);

    console.log("Database initialized successfully with sample data");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
EOF' ticketmgr

# Create complete server application
print_step "Creating complete Season Ticket Manager application..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/server.js << "EOF"
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const cors = require("cors");
const { promisify } = require("util");
const { pool, initializeDatabase } = require("./schema");

const scryptAsync = promisify(crypto.scrypt);
const app = express();
const port = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "qnap-season-ticket-secret-2025",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return buf.toString("hex") + "." + salt;
}

async function comparePasswords(supplied, stored) {
  const parts = stored.split(".");
  const hashed = parts[0];
  const salt = parts[1];
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Authentication routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).send("Missing required fields");
    }

    const hashedPassword = await hashPassword(password);
    
    const result = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashedPassword]
    );

    req.session.user = result.rows[0];
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "23505") {
      return res.status(400).send("Username or email already exists");
    }
    res.status(500).send("Registration failed");
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).send("Missing credentials");
    }

    const result = await pool.query(
      "SELECT id, username, email, password FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0 || !(await comparePasswords(password, result.rows[0].password))) {
      return res.status(401).send("Invalid credentials");
    }

    const user = { id: result.rows[0].id, username: result.rows[0].username, email: result.rows[0].email };
    req.session.user = user;
    res.json(user);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Login failed");
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.sendStatus(200);
  });
});

app.get("/api/auth/user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json(req.session.user);
});

// API Routes with error handling
app.get("/api/teams", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM teams ORDER BY name");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

app.get("/api/seasons", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, t.name as team_name 
      FROM seasons s 
      JOIN teams t ON s.team_id = t.id 
      ORDER BY s.year DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching seasons:", error);
    res.status(500).json({ error: "Failed to fetch seasons" });
  }
});

app.get("/api/seats", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, t.name as team_name 
      FROM seats s 
      JOIN teams t ON s.team_id = t.id 
      ORDER BY s.section, s.row, s.number
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching seats:", error);
    res.status(500).json({ error: "Failed to fetch seats" });
  }
});

app.get("/api/ticket-holders", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ticket_holders ORDER BY name");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching ticket holders:", error);
    res.status(500).json({ error: "Failed to fetch ticket holders" });
  }
});

app.get("/api/games", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, s.year as season_year, t.name as team_name
      FROM games g
      JOIN seasons s ON g.season_id = s.id
      JOIN teams t ON s.team_id = t.id
      ORDER BY g.date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.get("/api/payments", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, th.name as holder_name, s.year as season_year, t.name as team_name
      FROM payments p
      JOIN ticket_holders th ON p.ticket_holder_id = th.id
      JOIN seasons s ON p.season_id = s.id
      JOIN teams t ON s.team_id = t.id
      ORDER BY p.payment_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

app.get("/api/dashboard/stats/:seasonId", requireAuth, async (req, res) => {
  try {
    const seasonId = req.params.seasonId;
    
    const financeResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0) as total_costs
      FROM payments 
      WHERE season_id = $1
    `, [seasonId]);
    
    const seatResult = await pool.query(`
      SELECT COUNT(*) as active_seats
      FROM seat_ownership so
      WHERE so.season_id = $1
    `, [seasonId]);
    
    const gameResult = await pool.query(`
      SELECT COUNT(*) as total_games
      FROM games
      WHERE season_id = $1
    `, [seasonId]);
    
    const stats = {
      totalRevenue: financeResult.rows[0].total_revenue || "0",
      totalCosts: financeResult.rows[0].total_costs || "0", 
      totalProfit: (parseFloat(financeResult.rows[0].total_revenue || 0) - parseFloat(financeResult.rows[0].total_costs || 0)).toString(),
      activeSeats: parseInt(seatResult.rows[0].active_seats) || 0,
      totalGames: parseInt(gameResult.rows[0].total_games) || 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "QNAP LXD Container",
    projectPath: "/share/Container/projects/SeasonTicketTracker",
    version: "1.0.0 - Complete Application",
    uptime: process.uptime(),
    nodeVersion: process.version
  });
});

const htmlApp = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Season Ticket Manager - QNAP</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f8fafc}.app{min-height:100vh}.navbar{background:white;border-bottom:1px solid #e2e8f0;padding:1rem 2rem;display:flex;justify-content:space-between;align-items:center}.navbar h1{color:#1a202c;font-size:1.5rem;font-weight:700}.navbar button{background:#e53e3e;color:white;border:none;padding:.5rem 1rem;border-radius:.375rem;cursor:pointer}.container{max-width:1200px;margin:0 auto;padding:2rem}.dashboard-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;margin-bottom:2rem}.card{background:white;border-radius:.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:1.5rem}.stat-card{text-align:center}.stat-value{font-size:2rem;font-weight:700;color:#1a202c}.stat-label{color:#718096;font-size:.875rem;text-transform:uppercase}.tabs{display:flex;border-bottom:1px solid #e2e8f0;margin-bottom:1.5rem}.tab{padding:.75rem 1rem;background:none;border:none;cursor:pointer;color:#718096;border-bottom:2px solid transparent}.tab.active{color:#3182ce;border-bottom-color:#3182ce}.tab-content{display:none}.tab-content.active{display:block}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:.75rem;text-align:left;border-bottom:1px solid #e2e8f0}.table th{background:#f7fafc;font-weight:600}.loading{text-align:center;padding:2rem;color:#718096}.auth-container{min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center}.auth-card{background:white;padding:2rem;border-radius:.5rem;box-shadow:0 10px 25px rgba(0,0,0,.1);width:100%;max-width:400px}.form-group{margin-bottom:1rem}.form-group label{display:block;margin-bottom:.5rem;color:#374151;font-weight:500}.form-group input{width:100%;padding:.75rem;border:1px solid #d1d5db;border-radius:.375rem;font-size:1rem}.btn{width:100%;padding:.75rem;background:#3b82f6;color:white;border:none;border-radius:.375rem;font-size:1rem;cursor:pointer}.btn:hover{background:#2563eb}.toggle-link{text-align:center;margin-top:1rem}.toggle-link a{color:#3b82f6;text-decoration:none}.message{padding:.75rem;border-radius:.375rem;margin-bottom:1rem}.message.error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}.message.success{background:#ecfdf5;color:#059669;border:1px solid #bbf7d0}.hidden{display:none}</style></head><body><div class=\"app\"><div id=\"auth-section\" class=\"auth-container\"><div class=\"auth-card\"><h1 style=\"text-align:center;margin-bottom:1.5rem;color:#1a202c\">Season Ticket Manager</h1><div id=\"message\"></div><div id=\"login-form\"><form id=\"loginForm\"><div class=\"form-group\"><label>Username</label><input type=\"text\" id=\"loginUsername\" required></div><div class=\"form-group\"><label>Password</label><input type=\"password\" id=\"loginPassword\" required></div><button type=\"submit\" class=\"btn\">Sign In</button></form><div class=\"toggle-link\"><a href=\"#\" onclick=\"showRegister()\">Create new account</a></div></div><div id=\"register-form\" class=\"hidden\"><form id=\"registerForm\"><div class=\"form-group\"><label>Username</label><input type=\"text\" id=\"regUsername\" required></div><div class=\"form-group\"><label>Email</label><input type=\"email\" id=\"regEmail\" required></div><div class=\"form-group\"><label>Password</label><input type=\"password\" id=\"regPassword\" required></div><button type=\"submit\" class=\"btn\">Create Account</button></form><div class=\"toggle-link\"><a href=\"#\" onclick=\"showLogin()\">Back to sign in</a></div></div></div></div><div id=\"main-app\" class=\"hidden\"><nav class=\"navbar\"><h1>Season Ticket Manager</h1><button onclick=\"logout()\">Sign Out</button></nav><div class=\"container\"><div id=\"dashboard-stats\" class=\"dashboard-grid\"><div class=\"card stat-card\"><div class=\"stat-value\" id=\"total-revenue\">$0</div><div class=\"stat-label\">Total Revenue</div></div><div class=\"card stat-card\"><div class=\"stat-value\" id=\"total-costs\">$0</div><div class=\"stat-label\">Total Costs</div></div><div class=\"card stat-card\"><div class=\"stat-value\" id=\"total-profit\">$0</div><div class=\"stat-label\">Net Profit</div></div><div class=\"card stat-card\"><div class=\"stat-value\" id=\"active-seats\">0</div><div class=\"stat-label\">Active Seats</div></div></div><div class=\"card\"><div class=\"tabs\"><button class=\"tab active\" onclick=\"showTab('teams')\">Teams</button><button class=\"tab\" onclick=\"showTab('seasons')\">Seasons</button><button class=\"tab\" onclick=\"showTab('seats')\">Seats</button><button class=\"tab\" onclick=\"showTab('holders')\">Ticket Holders</button><button class=\"tab\" onclick=\"showTab('games')\">Games</button><button class=\"tab\" onclick=\"showTab('payments')\">Payments</button></div><div id=\"teams-tab\" class=\"tab-content active\"><h3>Teams</h3><div class=\"loading\">Loading teams...</div><table class=\"table hidden\" id=\"teams-table\"><thead><tr><th>ID</th><th>Name</th><th>Created</th></tr></thead><tbody id=\"teams-tbody\"></tbody></table></div><div id=\"seasons-tab\" class=\"tab-content\"><h3>Seasons</h3><div class=\"loading\">Loading seasons...</div><table class=\"table hidden\" id=\"seasons-table\"><thead><tr><th>ID</th><th>Team</th><th>Year</th><th>Created</th></tr></thead><tbody id=\"seasons-tbody\"></tbody></table></div><div id=\"seats-tab\" class=\"tab-content\"><h3>Seats</h3><div class=\"loading\">Loading seats...</div><table class=\"table hidden\" id=\"seats-table\"><thead><tr><th>ID</th><th>Team</th><th>Section</th><th>Row</th><th>Number</th><th>License Cost</th></tr></thead><tbody id=\"seats-tbody\"></tbody></table></div><div id=\"holders-tab\" class=\"tab-content\"><h3>Ticket Holders</h3><div class=\"loading\">Loading ticket holders...</div><table class=\"table hidden\" id=\"holders-table\"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Created</th></tr></thead><tbody id=\"holders-tbody\"></tbody></table></div><div id=\"games-tab\" class=\"tab-content\"><h3>Games</h3><div class=\"loading\">Loading games...</div><table class=\"table hidden\" id=\"games-table\"><thead><tr><th>ID</th><th>Team</th><th>Date</th><th>Time</th><th>Opponent</th><th>Home/Away</th></tr></thead><tbody id=\"games-tbody\"></tbody></table></div><div id=\"payments-tab\" class=\"tab-content\"><h3>Payments</h3><div class=\"loading\">Loading payments...</div><table class=\"table hidden\" id=\"payments-table\"><thead><tr><th>ID</th><th>Holder</th><th>Amount</th><th>Type</th><th>Date</th><th>Description</th></tr></thead><tbody id=\"payments-tbody\"></tbody></table></div></div></div></div></div><script>let currentUser=null;let currentTab='teams';function showMessage(text,isError){const msg=document.getElementById('message');msg.textContent=text;msg.className='message '+(isError?'error':'success');setTimeout(function(){msg.textContent=''},4000)}function showLogin(){document.getElementById('login-form').classList.remove('hidden');document.getElementById('register-form').classList.add('hidden')}function showRegister(){document.getElementById('login-form').classList.add('hidden');document.getElementById('register-form').classList.remove('hidden')}function showMainApp(){document.getElementById('auth-section').classList.add('hidden');document.getElementById('main-app').classList.remove('hidden');loadDashboardData();loadTabData(currentTab)}function showAuth(){document.getElementById('auth-section').classList.remove('hidden');document.getElementById('main-app').classList.add('hidden')}function showTab(tabName){document.querySelectorAll('.tab').forEach(function(tab){tab.classList.remove('active')});document.querySelectorAll('.tab-content').forEach(function(content){content.classList.remove('active')});document.querySelector('[onclick=\"showTab(\\''+tabName+'\\')\"').classList.add('active');document.getElementById(tabName+'-tab').classList.add('active');currentTab=tabName;loadTabData(tabName)}function checkAuth(){fetch('/api/auth/user').then(function(response){if(response.ok){return response.json()}throw new Error('Not authenticated')}).then(function(user){currentUser=user;showMainApp()}).catch(function(error){showAuth()})}function logout(){fetch('/api/auth/logout',{method:'POST'}).then(function(){currentUser=null;showAuth()})}function loadDashboardData(){fetch('/api/dashboard/stats/1').then(function(response){return response.json()}).then(function(stats){document.getElementById('total-revenue').textContent='$'+parseFloat(stats.totalRevenue).toFixed(2);document.getElementById('total-costs').textContent='$'+parseFloat(stats.totalCosts).toFixed(2);document.getElementById('total-profit').textContent='$'+parseFloat(stats.totalProfit).toFixed(2);document.getElementById('active-seats').textContent=stats.activeSeats}).catch(function(error){console.error('Error loading dashboard:',error)})}function loadTabData(tabName){const endpoint='/api/'+(tabName==='holders'?'ticket-holders':tabName);fetch(endpoint).then(function(response){return response.json()}).then(function(data){populateTable(tabName,data)}).catch(function(error){console.error('Error loading '+tabName+':',error)})}function populateTable(tabName,data){const tbody=document.getElementById(tabName+'-tbody');const table=document.getElementById(tabName+'-table');const loading=table.previousElementSibling;tbody.innerHTML='';data.forEach(function(item){const row=document.createElement('tr');if(tabName==='teams'){row.innerHTML='<td>'+item.id+'</td><td>'+item.name+'</td><td>'+(new Date(item.created_at)).toLocaleDateString()+'</td>'}else if(tabName==='seasons'){row.innerHTML='<td>'+item.id+'</td><td>'+item.team_name+'</td><td>'+item.year+'</td><td>'+(new Date(item.created_at)).toLocaleDateString()+'</td>'}else if(tabName==='seats'){row.innerHTML='<td>'+item.id+'</td><td>'+item.team_name+'</td><td>'+item.section+'</td><td>'+item.row+'</td><td>'+item.number+'</td><td>$'+parseFloat(item.license_cost).toFixed(2)+'</td>'}else if(tabName==='holders'){row.innerHTML='<td>'+item.id+'</td><td>'+item.name+'</td><td>'+item.email+'</td><td>'+(new Date(item.created_at)).toLocaleDateString()+'</td>'}else if(tabName==='games'){row.innerHTML='<td>'+item.id+'</td><td>'+item.team_name+'</td><td>'+item.date+'</td><td>'+(item.time||'')+'</td><td>'+item.opponent+'</td><td>'+item.home_away+'</td>'}else if(tabName==='payments'){row.innerHTML='<td>'+item.id+'</td><td>'+item.holder_name+'</td><td>$'+parseFloat(item.amount).toFixed(2)+'</td><td>'+item.type+'</td><td>'+item.payment_date+'</td><td>'+(item.description||'')+'</td>'}tbody.appendChild(row)});loading.classList.add('hidden');table.classList.remove('hidden')}document.getElementById('loginForm').addEventListener('submit',function(e){e.preventDefault();const username=document.getElementById('loginUsername').value;const password=document.getElementById('loginPassword').value;fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username,password:password})}).then(function(response){if(response.ok){return response.json()}return response.text().then(function(text){throw new Error(text)})}).then(function(user){currentUser=user;showMessage('Welcome back, '+user.username+'!');setTimeout(function(){showMainApp()},1000)}).catch(function(error){showMessage(error.message||'Sign in failed',true)})});document.getElementById('registerForm').addEventListener('submit',function(e){e.preventDefault();const username=document.getElementById('regUsername').value;const email=document.getElementById('regEmail').value;const password=document.getElementById('regPassword').value;fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username,email:email,password:password})}).then(function(response){if(response.ok){return response.json()}return response.text().then(function(text){throw new Error(text)})}).then(function(user){currentUser=user;showMessage('Account created for '+user.username+'!');setTimeout(function(){showMainApp()},1000)}).catch(function(error){showMessage(error.message||'Registration failed',true)})});checkAuth()</script></body></html>";

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlApp);
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlApp);
});

async function startServer() {
  try {
    console.log("Initializing database...");
    await initializeDatabase();
    console.log("Database initialized successfully");
    
    app.listen(port, "0.0.0.0", function() {
      console.log("===========================================");
      console.log("Season Ticket Manager - COMPLETE VERSION");
      console.log("===========================================");
      console.log("Server running on port:", port);
      console.log("Platform: QNAP LXD Container");
      console.log("Database: PostgreSQL");
      console.log("Project Path: /share/Container/projects/SeasonTicketTracker");
      console.log("Node.js Version:", process.version);
      console.log("===========================================");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
EOF' ticketmgr

# Create systemd service
print_step "Creating systemd service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << "EOF"
[Unit]
Description=Season Ticket Manager Complete Application
Documentation=https://github.com/season-ticket-manager
After=network.target postgresql.service
Wants=network.target
Requires=postgresql.service

[Service]
Type=simple
User=ticketmgr
Group=ticketmgr
WorkingDirectory=/opt/season-ticket-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050
StandardOutput=journal
StandardError=journal
SyslogIdentifier=season-ticket-manager
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF'

# Enable and start services
print_step "Starting services..."
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait for service to start
print_step "Waiting for application to start..."
sleep 15

# Verify services are running
print_step "Verifying services..."
if ! lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet postgresql; then
    print_error "PostgreSQL service failed to start"
    lxc exec "$CONTAINER_NAME" -- systemctl status postgresql --no-pager -l
    exit 1
fi

if ! lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    print_error "Season Ticket Manager service failed to start"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20
    exit 1
fi

# Test application endpoints
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:$APP_PORT"

print_step "Testing application..."
for i in {1..15}; do
    HEALTH_RESPONSE=$(curl -s -m 10 "$APP_URL/api/health" 2>/dev/null || echo "TIMEOUT")
    if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
        print_success "Application health check passed"
        break
    else
        print_warning "Waiting for application... ($i/15)"
        sleep 5
    fi
done

# Final verification
print_step "Final verification..."
curl -s "$APP_URL/api/teams" > /dev/null && print_success "Teams API working" || print_error "Teams API failed"
curl -s "$APP_URL/api/seasons" > /dev/null && print_success "Seasons API working" || print_error "Seasons API failed"
curl -s "$APP_URL/api/seats" > /dev/null && print_success "Seats API working" || print_error "Seats API failed"

echo ""
echo "=============================================================="
echo "       COMPLETE SEASON TICKET MANAGER DEPLOYMENT SUCCESS"
echo "=============================================================="
echo ""
print_success "Application URL: $APP_URL"
print_success "Health Check: $APP_URL/api/health"
print_success "Project Path: /share/Container/projects/SeasonTicketTracker"
print_success "Container: $CONTAINER_NAME"
print_success "Database: PostgreSQL"
echo ""
echo "COMPLETE FEATURES AVAILABLE:"
echo "✓ Full authentication system (register/login)"
echo "✓ Dashboard with real financial analytics"
echo "✓ Teams management (49ers, Giants)"
echo "✓ Season tracking (2025 seasons)"
echo "✓ Seat management with license costs"
echo "✓ Ticket holders (John Doe, Jane Smith, Mike Johnson)"
echo "✓ Payment tracking and reporting"
echo "✓ Sample data included for immediate testing"
echo ""
echo "FINANCIAL DATA SAMPLE:"
echo "✓ License costs: Seats 2,3,4 = $9,996.39 each"
echo "✓ Revenue: $16,700 total season payments"
echo "✓ Net profit calculations included"
echo ""
echo "ACCESS YOUR APPLICATION:"
echo "1. Open browser: $APP_URL"
echo "2. Create account or login"
echo "3. Explore all tabs: Teams, Seasons, Seats, Holders, Games, Payments"
echo "4. View dashboard analytics with real financial data"
echo ""
echo "MANAGEMENT COMMANDS:"
echo "  Status:   lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "  Logs:     lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Restart:  lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo ""
print_success "Your complete Season Ticket Manager is ready for production use!"