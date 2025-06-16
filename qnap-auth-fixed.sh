#!/bin/bash

# LXD Deployment with Basic Authentication - Fixed Port Issue
set -e

CONTAINER_NAME="season-ticket-manager-auth"
APP_PORT="5051"  # Changed to avoid conflict

echo "Season Ticket Manager - LXD Deployment with Basic Authentication"
echo "Using port $APP_PORT to avoid conflicts"
echo "=============================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root"
    exit 1
fi

# Stop any existing containers that might conflict
echo "Cleaning up existing containers..."
for container in $(lxc list --format csv -c n | grep season-ticket); do
    echo "Stopping container: $container"
    lxc stop "$container" --force 2>/dev/null || true
    lxc delete "$container" --force 2>/dev/null || true
done

# Launch container
echo "Creating Ubuntu 22.04 container..."
lxc launch ubuntu:22.04 "$CONTAINER_NAME"

# Wait for container
echo "Waiting for container to initialize..."
sleep 20

# Configure container resources
echo "Configuring container..."
lxc config set "$CONTAINER_NAME" limits.memory 2GB
lxc config set "$CONTAINER_NAME" limits.cpu 4

# Setup port forwarding with new port
echo "Setting up port forwarding on port $APP_PORT..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:5050

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

# Create package.json first
echo "Creating package configuration..."
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

# Install dependencies first
echo "Installing dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && npm install --silent' ticketmgr

# Create the simplified application
echo "Creating Season Ticket Manager application..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/server.js << '"'"'EOF'"'"'
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const app = express();
const port = 5050;

// Simple in-memory user storage for demo
const users = new Map();

// Create default admin user
async function createDefaultUser() {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync("admin123", salt, 64);
  const hashedPassword = `${buf.toString("hex")}.${salt}`;
  
  users.set("admin", {
    username: "admin",
    email: "admin@qnap.local",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    role: "admin"
  });
}

createDefaultUser();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: "qnap-season-ticket-secret-2025",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Password functions
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

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    platform: "QNAP LXD",
    authentication: "basic",
    users: users.size
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await comparePasswords(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.user = {
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };

    res.json(req.session.user);
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (users.has(username)) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await hashPassword(password);
    
    const newUser = {
      username,
      email,
      password: hashedPassword,
      firstName: firstName || "",
      lastName: lastName || "",
      role: "user"
    };
    
    users.set(username, newUser);
    
    req.session.user = {
      username,
      email,
      firstName,
      lastName,
      role: "user"
    };
    
    res.json(req.session.user);
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
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

// Protected routes with mock data
app.get("/api/dashboard/stats/1", requireAuth, (req, res) => {
  res.json({
    totalRevenue: "45000.00",
    totalCosts: "28000.00",
    netProfit: "17000.00",
    totalSeats: 3,
    occupiedSeats: 2,
    occupancyRate: 67
  });
});

app.get("/api/games", requireAuth, (req, res) => {
  res.json([
    { id: 1, date: "2025-01-15", time: "19:00", opponent: "Team A", isHomeGame: true },
    { id: 2, date: "2025-01-22", time: "19:30", opponent: "Team B", isHomeGame: false },
    { id: 3, date: "2025-01-29", time: "18:00", opponent: "Team C", isHomeGame: true }
  ]);
});

app.get("/api/ticket-holders", requireAuth, (req, res) => {
  res.json([
    { id: 1, name: "John Smith", email: "john@example.com", phone: "555-0123" },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com", phone: "555-0124" }
  ]);
});

app.get("/api/seats", requireAuth, (req, res) => {
  res.json([
    { id: 1, section: "A", row: "1", number: "1", licenseCost: "1000" },
    { id: 2, section: "A", row: "1", number: "2", licenseCost: "1000" },
    { id: 3, section: "B", row: "2", number: "5", licenseCost: "1200" }
  ]);
});

// HTML Application
const htmlApp = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Season Ticket Manager - QNAP Auth</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .auth-container { max-width: 400px; margin: 10vh auto; }
        .auth-card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .auth-header { text-align: center; margin-bottom: 2rem; }
        .auth-header h1 { color: #333; margin-bottom: 0.5rem; }
        .form-group { margin-bottom: 1.5rem; }
        .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333; }
        .form-group input { width: 100%; padding: 0.75rem; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 1rem; }
        .form-group input:focus { outline: none; border-color: #667eea; }
        .btn { width: 100%; padding: 0.875rem; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
        .btn:hover { background: #5a6fd8; }
        .toggle { text-align: center; margin-top: 1.5rem; }
        .toggle a { color: #667eea; text-decoration: none; }
        .message { padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
        .message.error { background: #fef2f2; color: #dc2626; }
        .message.success { background: #ecfdf5; color: #059669; }
        .hidden { display: none; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
        .logout-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
        .nav { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
        .nav-item { background: white; padding: 1rem; border-radius: 8px; cursor: pointer; flex: 1; text-align: center; min-width: 150px; }
        .nav-item.active { background: #667eea; color: white; }
        .content { background: white; padding: 2rem; border-radius: 12px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 1.5rem; border-radius: 10px; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .table th, .table td { padding: 1rem; text-align: left; border-bottom: 1px solid #eee; }
        .table th { background: #f8f9fa; }
        .status { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.875rem; }
        .status.success { background: #d4edda; color: #155724; }
        .status.info { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <div id="auth-section" class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <h1>Season Ticket Manager</h1>
                <p>QNAP LXD Authentication</p>
            </div>
            <div id="message"></div>
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
                <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; font-size: 0.85rem;">
                    <strong>Default Login:</strong><br>Username: admin<br>Password: admin123
                </div>
            </div>
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

    <div id="app-section" class="container hidden">
        <div class="header">
            <div>
                <h1>Season Ticket Manager</h1>
                <p>QNAP LXD Platform</p>
            </div>
            <div>
                <span>Welcome, <span id="username"></span></span>
                <button class="logout-btn" onclick="logout()">Sign Out</button>
            </div>
        </div>

        <div class="nav">
            <div class="nav-item active" onclick="showSection('dashboard')">Dashboard</div>
            <div class="nav-item" onclick="showSection('games')">Games</div>
            <div class="nav-item" onclick="showSection('tickets')">Ticket Holders</div>
            <div class="nav-item" onclick="showSection('seats')">Seats</div>
        </div>

        <div class="content">
            <div id="dashboard-section">
                <h2>Dashboard Overview</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="total-revenue">Loading...</div>
                        <div class="stat-label">Total Revenue</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="total-costs">Loading...</div>
                        <div class="stat-label">Total Costs</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="net-profit">Loading...</div>
                        <div class="stat-label">Net Profit</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="occupancy-rate">Loading...</div>
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
                    <tbody id="games-table">Loading...</tbody>
                </table>
            </div>

            <div id="tickets-section" class="hidden">
                <h2>Ticket Holders</h2>
                <table class="table">
                    <thead>
                        <tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th></tr>
                    </thead>
                    <tbody id="tickets-table">Loading...</tbody>
                </table>
            </div>

            <div id="seats-section" class="hidden">
                <h2>Seat Management</h2>
                <table class="table">
                    <thead>
                        <tr><th>Section</th><th>Row</th><th>Number</th><th>License Cost</th><th>Status</th></tr>
                    </thead>
                    <tbody id="seats-table">Loading...</tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
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
            document.getElementById("username").textContent = user.firstName || user.username;
            document.getElementById("auth-section").classList.add("hidden");
            document.getElementById("app-section").classList.remove("hidden");
            loadData();
        }

        function showAuth() {
            document.getElementById("auth-section").classList.remove("hidden");
            document.getElementById("app-section").classList.add("hidden");
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

                document.getElementById("total-revenue").textContent = "$" + stats.totalRevenue;
                document.getElementById("total-costs").textContent = "$" + stats.totalCosts;
                document.getElementById("net-profit").textContent = "$" + stats.netProfit;
                document.getElementById("occupancy-rate").textContent = stats.occupancyRate + "%";

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
                    showMessage("Welcome back!");
                    setTimeout(() => showApp(user), 1000);
                } else {
                    const error = await response.json();
                    showMessage(error.message, true);
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
                    showMessage("Account created!");
                    setTimeout(() => showApp(user), 1000);
                } else {
                    const error = await response.json();
                    showMessage(error.message, true);
                }
            } catch (error) {
                showMessage("Connection error", true);
            }
        });

        checkAuth();
    </script>
</body>
</html>`;

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Season Ticket Manager running on port ${port}`);
  console.log(`Platform: QNAP LXD Container with Authentication`);
  console.log(`Default login: admin / admin123`);
});
EOF' ticketmgr

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

# Check service status
echo "Checking service status..."
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "Service is running successfully"
    
    # Test the application
    HEALTH_RESPONSE=$(lxc exec "$CONTAINER_NAME" -- curl -s http://localhost:5050/api/health || echo "failed")
    if [[ "$HEALTH_RESPONSE" == *"ok"* ]]; then
        echo "Application health check passed"
    else
        echo "Health check failed: $HEALTH_RESPONSE"
    fi
else
    echo "Service failed to start. Checking logs..."
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20
    exit 1
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
echo "Login Details:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Features:"
echo "  - User authentication and registration"
echo "  - Dashboard with financial analytics"
echo "  - Games management"
echo "  - Ticket holder tracking"
echo "  - Seat management"
echo ""
echo "Management Commands:"
echo "  Check status: lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "  View logs:    lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Restart:      lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo "  Container:    lxc stop/start $CONTAINER_NAME"
echo ""
echo "Season Ticket Manager with Authentication is ready!"