#!/bin/bash

set -e

echo "Season Ticket Manager - QNAP LXD Deployment (Fixed)"
echo "===================================================="

# Configuration
CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"
MEMORY_LIMIT="1GB"
CPU_LIMIT="2"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root: sudo $0"
    exit 1
fi

# Stop existing container
if lxc list | grep -q "$CONTAINER_NAME"; then
    print_step "Removing existing container..."
    lxc stop "$CONTAINER_NAME" --force 2>/dev/null || true
    lxc delete "$CONTAINER_NAME" --force 2>/dev/null || true
fi

# Create new Ubuntu container
print_step "Launching Ubuntu 22.04 container..."
lxc launch ubuntu:22.04 "$CONTAINER_NAME"

print_step "Waiting for container initialization..."
sleep 15

# Configure container
print_step "Configuring container resources..."
lxc config set "$CONTAINER_NAME" limits.memory "$MEMORY_LIMIT"
lxc config set "$CONTAINER_NAME" limits.cpu "$CPU_LIMIT"

# Setup port forwarding
print_step "Setting up port forwarding..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT

# Install Node.js
print_step "Installing Node.js and dependencies..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq
    apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential
"

# Create application structure
print_step "Setting up application structure..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    mkdir -p /opt/season-ticket-manager
    useradd -r -s /bin/bash -d /opt/season-ticket-manager ticketmgr
    chown -R ticketmgr:ticketmgr /opt/season-ticket-manager
"

# Create package.json with CommonJS
print_step "Creating Node.js application..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/package.json << EOF
{
  "name": "season-ticket-manager-qnap",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3"
  }
}
EOF' ticketmgr

# Install dependencies
print_step "Installing Node.js dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && npm install --silent' ticketmgr

# Create server with CommonJS syntax
print_step "Deploying Season Ticket Manager application..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/server.js << EOF
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const app = express();
const port = process.env.PORT || 5050;

// In-memory user storage
const users = new Map();

// Middleware
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

// Password utilities
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
}

// Authentication routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).send("Missing required fields");
    }

    if (users.has(username)) {
      return res.status(400).send("Username already exists");
    }

    const hashedPassword = await hashPassword(password);
    users.set(username, { username, email, password: hashedPassword });

    req.session.user = { username, email };
    res.json({ username, email });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("Registration failed");
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).send("Missing credentials");
    }

    const user = users.get(username);
    if (!user || !(await comparePasswords(password, user.password))) {
      return res.status(401).send("Invalid credentials");
    }

    req.session.user = { username: user.username, email: user.email };
    res.json({ username: user.username, email: user.email });
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

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "QNAP LXD Container",
    projectPath: "/share/Container/projects/SeasonTicketTracker",
    version: "1.0.0",
    users: users.size,
    uptime: process.uptime()
  });
});

// Frontend HTML
const htmlApp = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Season Ticket Manager - QNAP</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
    }
    .container { max-width: 450px; width: 90%; padding: 20px; }
    .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
    .header { text-align: center; margin-bottom: 2rem; }
    .header h1 { font-size: 1.875rem; font-weight: 800; color: #1f2937; margin-bottom: 0.5rem; }
    .header p { color: #6b7280; font-size: 0.875rem; }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151; }
    .form-group input { width: 100%; padding: 0.75rem 1rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 1rem; transition: border-color 0.2s; }
    .form-group input:focus { outline: none; border-color: #3b82f6; }
    .btn { width: 100%; padding: 0.875rem; background: #3b82f6; color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .btn-danger { background: #ef4444; margin-top: 1.5rem; }
    .btn-danger:hover { background: #dc2626; }
    .toggle { text-align: center; margin-top: 1.5rem; }
    .toggle a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    .message { padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-size: 0.875rem; }
    .message.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .message.success { background: #ecfdf5; color: #059669; border: 1px solid #bbf7d0; }
    .dashboard { display: none; }
    .welcome { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; padding: 1.5rem; border-radius: 0.75rem; text-align: center; margin-bottom: 1.5rem; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .stat { background: #f9fafb; padding: 1.5rem; border-radius: 0.75rem; text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: 800; color: #1f2937; }
    .stat-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
    .project-info { background: #f0f9ff; padding: 1rem; border-radius: 0.5rem; border: 1px solid #bae6fd; margin-bottom: 1.5rem; }
    .project-info h3 { color: #0c4a6e; margin-bottom: 0.5rem; }
    .project-info p { color: #075985; font-size: 0.875rem; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div id="auth-section" class="card">
      <div class="header">
        <h1>Season Ticket Manager</h1>
        <p>QNAP LXD Container Platform</p>
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

    <div id="dashboard-section" class="card dashboard">
      <div class="header">
        <h2>Dashboard</h2>
        <p>Season Ticket Manager</p>
      </div>
      
      <div class="welcome">
        <h3>Container Deployment Successful</h3>
        <p>Running on QNAP LXD with optimized performance</p>
      </div>
      
      <div class="project-info">
        <h3>Project Location</h3>
        <p>/share/Container/projects/SeasonTicketTracker</p>
      </div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">$0</div>
          <div class="stat-label">Revenue</div>
        </div>
        <div class="stat">
          <div class="stat-value">0</div>
          <div class="stat-label">Active Seats</div>
        </div>
      </div>
      
      <button class="btn btn-danger" onclick="logout()">Sign Out</button>
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

    function showDashboard(user) {
      currentUser = user;
      document.getElementById("auth-section").style.display = "none";
      document.getElementById("dashboard-section").style.display = "block";
    }

    function showAuth() {
      document.getElementById("auth-section").style.display = "block";
      document.getElementById("dashboard-section").style.display = "none";
      currentUser = null;
    }

    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/user");
        if (response.ok) {
          const user = await response.json();
          showDashboard(user);
          return true;
        }
      } catch (error) {
        console.log("Not authenticated");
      }
      return false;
    }

    window.logout = async function() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        showMessage("Signed out successfully");
        showAuth();
      } catch (error) {
        showMessage("Sign out failed", true);
      }
    };

    window.showLogin = showLogin;
    window.showRegister = showRegister;

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
          showMessage("Welcome back, " + user.username + "!");
          setTimeout(() => showDashboard(user), 1000);
        } else {
          const error = await response.text();
          showMessage(error || "Sign in failed", true);
        }
      } catch (error) {
        showMessage("Connection error", true);
      }
    });

    document.getElementById("registerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("regUsername").value;
      const email = document.getElementById("regEmail").value;
      const password = document.getElementById("regPassword").value;

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password })
        });

        if (response.ok) {
          const user = await response.json();
          showMessage("Account created for " + user.username + "!");
          setTimeout(() => showDashboard(user), 1000);
        } else {
          const error = await response.text();
          showMessage(error || "Registration failed", true);
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
  console.log(`Platform: QNAP LXD Container`);
  console.log(`Project Path: /share/Container/projects/SeasonTicketTracker`);
  console.log(`Health endpoint: http://localhost:${port}/api/health`);
});
EOF' ticketmgr

# Create systemd service
print_step "Creating systemd service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager Application
After=network.target
Wants=network.target

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

[Install]
WantedBy=multi-user.target
EOF'

# Start service
print_step "Starting Season Ticket Manager service..."
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

sleep 5

# Check status
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    print_success "Service is running successfully"
else
    print_error "Service failed to start"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
    exit 1
fi

# Test application
QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
APP_URL="http://$QNAP_IP:$APP_PORT"

print_step "Testing application..."
sleep 3

HEALTH_RESPONSE=$(curl -s "$APP_URL/api/health" 2>/dev/null || echo "FAILED")
if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    print_success "Health check passed"
else
    print_error "Health check failed"
fi

echo ""
echo "=================================================="
echo "         DEPLOYMENT COMPLETED SUCCESSFULLY"
echo "=================================================="
echo ""
print_success "Application URL: $APP_URL"
print_success "Health Check: $APP_URL/api/health"
print_success "Project Path: /share/Container/projects/SeasonTicketTracker"
echo ""
echo "Test the application:"
echo "1. Open browser to $APP_URL"
echo "2. Create an account"
echo "3. Test login functionality"
echo ""
echo "Management commands:"
echo "  View status: lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "  View logs:   lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Restart:     lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo ""
print_success "Season Ticket Manager is ready!"