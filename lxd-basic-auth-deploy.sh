#!/bin/bash

# LXD Deployment with Basic Authentication for Season Ticket Manager
set -e

CONTAINER_NAME="season-ticket-manager-auth"
APP_PORT="5050"

echo "Season Ticket Manager - LXD Deployment with Basic Authentication"
echo "=============================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./lxd-basic-auth-deploy.sh"
    exit 1
fi

# Stop existing container if it exists
if lxc list 2>/dev/null | grep -q "$CONTAINER_NAME"; then
    echo "Stopping existing container..."
    lxc stop "$CONTAINER_NAME" --force 2>/dev/null || true
    lxc delete "$CONTAINER_NAME" --force 2>/dev/null || true
fi

# Launch container
echo "Creating Ubuntu 22.04 container..."
lxc launch ubuntu:22.04 "$CONTAINER_NAME"

# Wait for container
echo "Waiting for container to initialize..."
sleep 15

# Configure container resources
echo "Configuring container..."
lxc config set "$CONTAINER_NAME" limits.memory 2GB
lxc config set "$CONTAINER_NAME" limits.cpu 4

# Setup port forwarding
echo "Setting up port forwarding..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT

# Install Node.js and dependencies
echo "Installing Node.js and dependencies..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq
    apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential curl sqlite3
"

# Create application directory and user
echo "Setting up application structure..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    mkdir -p /opt/season-ticket-manager
    useradd -r -s /bin/bash -d /opt/season-ticket-manager ticketmgr
    chown -R ticketmgr:ticketmgr /opt/season-ticket-manager
"

# Create the complete application with authentication
echo "Creating Season Ticket Manager with authentication..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/server.js << '"'"'EOF'"'"'
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scryptAsync = promisify(scrypt);

const app = express();
const port = process.env.PORT || 5050;

// Initialize SQLite database
const db = new sqlite3.Database("./users.db");

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    firstName TEXT,
    lastName TEXT,
    role TEXT DEFAULT "user",
    isActive INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create default admin user (password: admin123)
  db.get("SELECT * FROM users WHERE username = ?", ["admin"], async (err, row) => {
    if (!row) {
      const hashedPassword = await hashPassword("admin123");
      db.run("INSERT INTO users (username, email, password, firstName, lastName, role) VALUES (?, ?, ?, ?, ?, ?)",
        ["admin", "admin@qnap.local", hashedPassword, "Admin", "User", "admin"]);
      console.log("Default admin user created: admin/admin123");
    }
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || "qnap-season-ticket-secret-2025",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Password hashing functions
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Authentication routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const hashedPassword = await hashPassword(password);
    
    db.run("INSERT INTO users (username, email, password, firstName, lastName) VALUES (?, ?, ?, ?, ?)",
      [username, email, hashedPassword, firstName || "", lastName || ""], function(err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({ message: "Username or email already exists" });
          }
          return res.status(500).json({ message: "Registration failed" });
        }
        
        req.session.user = { id: this.lastID, username, email, firstName, lastName, role: "user" };
        res.json({ id: this.lastID, username, email, firstName, lastName, role: "user" });
      });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    db.get("SELECT * FROM users WHERE username = ? AND isActive = 1", [username], async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

app.get("/api/auth/user", requireAuth, (req, res) => {
  res.json(req.session.user);
});

// Protected API routes with mock data
const mockData = {
  teams: [{ id: 1, name: "Home Team", createdAt: new Date().toISOString() }],
  seasons: [{ id: 1, teamId: 1, year: 2025, createdAt: new Date().toISOString() }],
  games: [
    { id: 1, seasonId: 1, date: "2025-01-15", time: "19:00", opponent: "Team A", isHomeGame: true },
    { id: 2, seasonId: 1, date: "2025-01-22", time: "19:30", opponent: "Team B", isHomeGame: false },
    { id: 3, seasonId: 1, date: "2025-01-29", time: "18:00", opponent: "Team C", isHomeGame: true }
  ],
  ticketHolders: [
    { id: 1, name: "John Smith", email: "john@example.com", phone: "555-0123" },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com", phone: "555-0124" }
  ],
  seats: [
    { id: 1, teamId: 1, section: "A", row: "1", number: "1", licenseCost: "1000" },
    { id: 2, teamId: 1, section: "A", row: "1", number: "2", licenseCost: "1000" },
    { id: 3, teamId: 1, section: "B", row: "2", number: "5", licenseCost: "1200" }
  ]
};

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    platform: "QNAP LXD",
    authentication: "basic",
    version: "2.0"
  });
});

app.get("/api/teams", requireAuth, (req, res) => res.json(mockData.teams));
app.get("/api/seasons", requireAuth, (req, res) => res.json(mockData.seasons));
app.get("/api/games", requireAuth, (req, res) => res.json(mockData.games));
app.get("/api/ticket-holders", requireAuth, (req, res) => res.json(mockData.ticketHolders));
app.get("/api/seats", requireAuth, (req, res) => res.json(mockData.seats));
app.get("/api/seat-ownership", requireAuth, (req, res) => res.json([]));
app.get("/api/payments", requireAuth, (req, res) => res.json([]));
app.get("/api/transfers", requireAuth, (req, res) => res.json([]));
app.get("/api/game-attendance", requireAuth, (req, res) => res.json([]));
app.get("/api/game-pricing", requireAuth, (req, res) => res.json([]));

app.get("/api/dashboard/stats/:seasonId", requireAuth, (req, res) => {
  res.json({
    totalRevenue: "45000.00",
    totalCosts: "28000.00",
    netProfit: "17000.00",
    totalSeats: 3,
    occupiedSeats: 2,
    occupancyRate: 67
  });
});

// HTML Application with Authentication
const htmlApp = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Season Ticket Manager - QNAP</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .auth-container { max-width: 400px; margin: 10vh auto; }
        .auth-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .auth-header { text-align: center; margin-bottom: 2rem; }
        .auth-header h1 { color: #333; margin-bottom: 0.5rem; }
        .auth-header p { color: #666; font-size: 0.9rem; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333; }
        .form-group input { width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 1rem; transition: border-color 0.2s; }
        .form-group input:focus { outline: none; border-color: #667eea; }
        .btn { width: 100%; padding: 0.875rem; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .btn:hover { background: #5a6fd8; }
        .btn:disabled { background: #a0a0a0; cursor: not-allowed; }
        .toggle { text-align: center; margin-top: 1.5rem; }
        .toggle a { color: #667eea; text-decoration: none; font-weight: 500; }
        .message { padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.9rem; }
        .message.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .message.success { background: #ecfdf5; color: #059669; border: 1px solid #bbf7d0; }
        .hidden { display: none; }
        
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { font-size: 2.5rem; }
        .header .user-info { text-align: right; }
        .logout-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
        .nav { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
        .nav-item { background: white; padding: 1rem; border-radius: 8px; cursor: pointer; transition: transform 0.2s; flex: 1; text-align: center; min-width: 150px; }
        .nav-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .nav-item.active { background: #667eea; color: white; }
        .content { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.5rem; border-radius: 10px; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .stat-label { opacity: 0.9; }
        .table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .table th, .table td { padding: 1rem; text-align: left; border-bottom: 1px solid #eee; }
        .table th { background: #f8f9fa; font-weight: 600; }
        .status { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.875rem; font-weight: 500; }
        .status.success { background: #d4edda; color: #155724; }
        .status.info { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <!-- Authentication Section -->
    <div id="auth-section" class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <h1>Season Ticket Manager</h1>
                <p>QNAP LXD Container Platform</p>
            </div>
            
            <div id="message"></div>
            
            <!-- Login Form -->
            <div id="login-form">
                <form id="loginForm">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="loginUsername" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="loginPassword" required>
                    </div>
                    <button type="submit" class="btn">Sign In</button>
                </form>
                <div class="toggle">
                    <a href="#" onclick="showRegister()">Create new account</a>
                </div>
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; font-size: 0.85rem; color: #666;">
                    <strong>Default Login:</strong><br>
                    Username: admin<br>
                    Password: admin123
                </div>
            </div>
            
            <!-- Register Form -->
            <div id="register-form" class="hidden">
                <form id="registerForm">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="regUsername" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="regEmail" required>
                    </div>
                    <div class="form-group">
                        <label>First Name</label>
                        <input type="text" id="regFirstName">
                    </div>
                    <div class="form-group">
                        <label>Last Name</label>
                        <input type="text" id="regLastName">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="regPassword" required>
                    </div>
                    <button type="submit" class="btn">Create Account</button>
                </form>
                <div class="toggle">
                    <a href="#" onclick="showLogin()">Back to sign in</a>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Application -->
    <div id="app-section" class="container hidden">
        <div class="header">
            <div>
                <h1>Season Ticket Manager</h1>
                <p>QNAP LXD Container Platform</p>
            </div>
            <div class="user-info">
                <div>Welcome, <span id="username"></span></div>
                <button class="logout-btn" onclick="logout()">Sign Out</button>
            </div>
        </div>

        <div class="nav">
            <div class="nav-item active" onclick="showSection('dashboard')">Dashboard</div>
            <div class="nav-item" onclick="showSection('games')">Games</div>
            <div class="nav-item" onclick="showSection('finances')">Finances</div>
            <div class="nav-item" onclick="showSection('tickets')">Ticket Holders</div>
            <div class="nav-item" onclick="showSection('seats')">Seats</div>
        </div>

        <div class="content">
            <div id="dashboard-section">
                <h2>Dashboard Overview</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="total-revenue">$0</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="total-costs">$0</div>
                        <div class="stat-label">Total Costs</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="net-profit">$0</div>
                        <div class="stat-label">Net Profit</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="occupancy-rate">0%</div>
                        <div class="stat-label">Occupancy Rate</div>
                    </div>
                </div>
            </div>

            <div id="games-section" class="hidden">
                <h2>Games Management</h2>
                <table class="table">
                    <thead>
                        <tr><th>Date</th><th>Time</th><th>Opponent</th><th>Type</th><th>Status</th></tr>
                    </thead>
                    <tbody id="games-table"></tbody>
                </table>
            </div>

            <div id="finances-section" class="hidden">
                <h2>Financial Overview</h2>
                <p>Financial tracking and payment management system.</p>
            </div>

            <div id="tickets-section" class="hidden">
                <h2>Ticket Holders</h2>
                <table class="table">
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th></tr>
                    </thead>
                    <tbody id="tickets-table"></tbody>
                </table>
            </div>

            <div id="seats-section" class="hidden">
                <h2>Seat Management</h2>
                <table class="table">
                    <thead>
                        <tr><th>Section</th><th>Row</th><th>Number</th><th>License Cost</th><th>Status</th></tr>
                    </thead>
                    <tbody id="seats-table"></tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        let currentUser = null;

        function showMessage(text, isError = false) {
            const msg = document.getElementById("message");
            msg.textContent = text;
            msg.className = "message " + (isError ? "error" : "success");
            setTimeout(() => msg.textContent = "", 4000);
        }

        function showLogin() {
            document.getElementById("login-form").classList.remove("hidden");
            document.getElementById("register-form").classList.add("hidden");
        }

        function showRegister() {
            document.getElementById("login-form").classList.add("hidden");
            document.getElementById("register-form").classList.remove("hidden");
        }

        function showApp(user) {
            currentUser = user;
            document.getElementById("username").textContent = user.firstName || user.username;
            document.getElementById("auth-section").classList.add("hidden");
            document.getElementById("app-section").classList.remove("hidden");
            loadData();
        }

        function showAuth() {
            document.getElementById("auth-section").classList.remove("hidden");
            document.getElementById("app-section").classList.add("hidden");
            currentUser = null;
        }

        function showSection(section) {
            document.querySelectorAll("[id$=\\"-section\\"]").forEach(el => {
                if (el.id !== "auth-section" && el.id !== "app-section") {
                    el.classList.add("hidden");
                }
            });
            document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
            
            document.getElementById(section + "-section").classList.remove("hidden");
            event.target.classList.add("active");
        }

        async function checkAuth() {
            try {
                const response = await fetch("/api/auth/user");
                if (response.ok) {
                    const user = await response.json();
                    showApp(user);
                    return true;
                }
            } catch (error) {}
            return false;
        }

        async function logout() {
            try {
                await fetch("/api/auth/logout", { method: "POST" });
                showMessage("Signed out successfully");
                showAuth();
            } catch (error) {
                showMessage("Sign out failed", true);
            }
        }

        async function loadData() {
            try {
                const [stats, games, tickets, seats] = await Promise.all([
                    fetch("/api/dashboard/stats/1").then(r => r.json()),
                    fetch("/api/games").then(r => r.json()),
                    fetch("/api/ticket-holders").then(r => r.json()),
                    fetch("/api/seats").then(r => r.json())
                ]);

                document.getElementById("total-revenue").textContent = "$" + (stats.totalRevenue || "0");
                document.getElementById("total-costs").textContent = "$" + (stats.totalCosts || "0");
                document.getElementById("net-profit").textContent = "$" + (stats.netProfit || "0");
                document.getElementById("occupancy-rate").textContent = (stats.occupancyRate || 0) + "%";

                document.getElementById("games-table").innerHTML = games.map(game => 
                    "<tr><td>" + game.date + "</td><td>" + game.time + "</td><td>" + game.opponent + 
                    "</td><td>" + (game.isHomeGame ? "Home" : "Away") + "</td><td><span class=\\"status success\\">Scheduled</span></td></tr>"
                ).join("");

                document.getElementById("tickets-table").innerHTML = tickets.map(ticket => 
                    "<tr><td>" + ticket.name + "</td><td>" + ticket.email + "</td><td>" + 
                    (ticket.phone || "N/A") + "</td><td><span class=\\"status info\\">Active</span></td></tr>"
                ).join("");

                document.getElementById("seats-table").innerHTML = seats.map(seat => 
                    "<tr><td>" + seat.section + "</td><td>" + seat.row + "</td><td>" + seat.number + 
                    "</td><td>$" + seat.licenseCost + "</td><td><span class=\\"status success\\">Available</span></td></tr>"
                ).join("");

            } catch (error) {
                console.error("Error loading data:", error);
            }
        }

        // Event listeners
        document.getElementById("loginForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("loginUsername").value;
            const password = document.getElementById("loginPassword").value;

            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password })
                });

                if (response.ok) {
                    const user = await response.json();
                    showMessage("Welcome back, " + (user.firstName || user.username) + "!");
                    setTimeout(() => showApp(user), 1000);
                } else {
                    const error = await response.json();
                    showMessage(error.message || "Sign in failed", true);
                }
            } catch (error) {
                showMessage("Connection error", true);
            }
        });

        document.getElementById("registerForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("regUsername").value;
            const email = document.getElementById("regEmail").value;
            const firstName = document.getElementById("regFirstName").value;
            const lastName = document.getElementById("regLastName").value;
            const password = document.getElementById("regPassword").value;

            try {
                const response = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, email, firstName, lastName, password })
                });

                if (response.ok) {
                    const user = await response.json();
                    showMessage("Account created for " + (user.firstName || user.username) + "!");
                    setTimeout(() => showApp(user), 1000);
                } else {
                    const error = await response.json();
                    showMessage(error.message || "Registration failed", true);
                }
            } catch (error) {
                showMessage("Connection error", true);
            }
        });

        // Initialize
        checkAuth();
    </script>
</body>
</html>`;

// Serve the web application
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

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Season Ticket Manager running on port ${port}`);
  console.log(`Platform: QNAP LXD Container with Basic Authentication`);
  console.log(`Default login: admin / admin123`);
});
EOF' ticketmgr

# Create package.json with all dependencies
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/package.json << EOF
{
  "name": "season-ticket-manager-auth",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "sqlite3": "^5.1.6"
  }
}
EOF' ticketmgr

# Install dependencies
echo "Installing dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && npm install --silent' ticketmgr

# Create systemd service
echo "Creating systemd service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager with Authentication
After=network.target

[Service]
Type=simple
User=ticketmgr
WorkingDirectory=/opt/season-ticket-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=5050
Environment=SESSION_SECRET=qnap-season-ticket-secret-2025

[Install]
WantedBy=multi-user.target
EOF'

# Start service
echo "Starting application..."
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait and test
sleep 10

# Check if service is running
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "Service is running successfully"
else
    echo "Service failed to start:"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
    exit 1
fi

# Test application
echo "Testing application..."
RESPONSE=$(lxc exec "$CONTAINER_NAME" -- curl -s http://localhost:5050/api/health || echo "failed")
if [[ "$RESPONSE" == *"ok"* ]]; then
    echo "Application is responding correctly"
else
    echo "Application test failed: $RESPONSE"
fi

# Get QNAP IP
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)

echo ""
echo "========================================="
echo "DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Application URL: http://$QNAP_IP:$APP_PORT"
echo "Health Check:    http://$QNAP_IP:$APP_PORT/api/health"
echo ""
echo "Authentication Details:"
echo "  Default Login: admin / admin123"
echo "  Users can register new accounts"
echo "  SQLite database for user storage"
echo "  Session-based authentication"
echo ""
echo "Features Available:"
echo "  - User registration and login"
echo "  - Protected dashboard and analytics"
echo "  - Games scheduling and management"
echo "  - Ticket holder tracking"
echo "  - Seat management system"
echo "  - Financial overview and reporting"
echo ""
echo "Management Commands:"
echo "  Status:    lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "  Logs:      lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Restart:   lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo "  Database:  lxc exec $CONTAINER_NAME -- sqlite3 /opt/season-ticket-manager/users.db"
echo "  Stop:      lxc stop $CONTAINER_NAME"
echo "  Start:     lxc start $CONTAINER_NAME"
echo ""
echo "Your Season Ticket Manager with Basic Authentication is ready!"