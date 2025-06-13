#!/bin/bash

set -e

echo "Season Ticket Manager - QNAP LXD Deployment"
echo "============================================"

# Configuration
CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"
MEMORY_LIMIT="1GB"
CPU_LIMIT="2"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (or with sudo)"
    exit 1
fi

# Check if LXD is available
if ! command -v lxc &> /dev/null; then
    echo "LXD not found. Please install LXD on your QNAP system first."
    exit 1
fi

echo "Creating LXD container..."

# Stop and delete existing container if it exists
if lxc list | grep -q "$CONTAINER_NAME"; then
    echo "Stopping existing container..."
    lxc stop "$CONTAINER_NAME" --force 2>/dev/null || true
    lxc delete "$CONTAINER_NAME" --force 2>/dev/null || true
fi

# Create new Ubuntu container
echo "Launching Ubuntu 22.04 container..."
lxc launch ubuntu:22.04 "$CONTAINER_NAME"

# Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 10

# Configure container resources
echo "Configuring container resources..."
lxc config set "$CONTAINER_NAME" limits.memory "$MEMORY_LIMIT"
lxc config set "$CONTAINER_NAME" limits.cpu "$CPU_LIMIT"

# Add port forwarding
echo "Setting up port forwarding on port $APP_PORT..."
lxc config device add "$CONTAINER_NAME" web proxy \
    listen=tcp:0.0.0.0:$APP_PORT \
    connect=tcp:127.0.0.1:$APP_PORT

# Update container and install Node.js
echo "Installing dependencies in container..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    apt update -q
    apt upgrade -y -q
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -q nodejs build-essential
"

# Create application structure
echo "Setting up application structure..."
lxc exec "$CONTAINER_NAME" -- bash -c "
    mkdir -p /opt/season-ticket-manager
    useradd -r -s /bin/bash -d /opt/season-ticket-manager ticketmgr
    chown -R ticketmgr:ticketmgr /opt/season-ticket-manager
"

# Create package.json
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/package.json << '\''EOF'\''
{
  "name": "season-ticket-manager-lxd",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3"
  }
}
EOF' ticketmgr

# Install npm dependencies
echo "Installing Node.js dependencies..."
lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && npm install' ticketmgr

# Create application server
echo "Creating application server..."
lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/server.js << '\''EOF'\''
import express from '\''express'\'';
import session from '\''express-session'\'';
import { scrypt, randomBytes, timingSafeEqual } from '\''crypto'\'';
import { promisify } from '\''util'\'';

const scryptAsync = promisify(scrypt);
const app = express();
const port = process.env.PORT || 5050;

// In-memory user storage
const users = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || '\''qnap-lxd-session-secret-2025'\'',
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
  const salt = randomBytes(16).toString('\''hex'\'');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('\''hex'\'')}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('\''.'\'');
  const hashedBuf = Buffer.from(hashed, '\''hex'\'');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Authentication routes
app.post('\''/api/auth/register'\'', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).send('\''Missing required fields'\'');
    }

    if (users.has(username)) {
      return res.status(400).send('\''Username already exists'\'');
    }

    const hashedPassword = await hashPassword(password);
    users.set(username, { username, email, password: hashedPassword });

    req.session.user = { username, email };
    res.json({ username, email });
  } catch (error) {
    console.error('\''Registration error:'\'', error);
    res.status(500).send('\''Registration failed'\'');
  }
});

app.post('\''/api/auth/login'\'', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).send('\''Missing credentials'\'');
    }

    const user = users.get(username);
    if (!user || !(await comparePasswords(password, user.password))) {
      return res.status(401).send('\''Invalid credentials'\'');
    }

    req.session.user = { username: user.username, email: user.email };
    res.json({ username: user.username, email: user.email });
  } catch (error) {
    console.error('\''Login error:'\'', error);
    res.status(500).send('\''Login failed'\'');
  }
});

app.post('\''/api/auth/logout'\'', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('\''Logout failed'\'');
    res.sendStatus(200);
  });
});

app.get('\''/api/auth/user'\'', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: '\''Not authenticated'\'' });
  }
  res.json(req.session.user);
});

app.get('\''/api/health'\'', (req, res) => {
  res.json({ 
    status: '\''healthy'\'',
    timestamp: new Date().toISOString(),
    platform: '\''QNAP LXD'\'',
    users: users.size
  });
});

// Static HTML application with embedded CSS and JavaScript
const htmlApp = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Season Ticket Manager - QNAP LXD</title>
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
    .platform-info { background: #f0f9ff; padding: 1rem; border-radius: 0.5rem; border: 1px solid #bae6fd; margin-bottom: 1.5rem; }
    .platform-info h3 { color: #0c4a6e; margin-bottom: 0.5rem; }
    .platform-info p { color: #075985; font-size: 0.875rem; }
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
        <p>QNAP LXD Container Management</p>
      </div>
      
      <div class="welcome">
        <h3>Season Ticket Manager</h3>
        <p>Successfully running on QNAP LXD container</p>
      </div>
      
      <div class="platform-info">
        <h3>Container Platform: QNAP LXD</h3>
        <p>High-performance container with direct system access and optimized resource allocation</p>
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
      const msg = document.getElementById('\''message'\'');
      msg.textContent = text;
      msg.className = '\''message '\'' + (isError ? '\''error'\'' : '\''success'\'');
      setTimeout(() => msg.textContent = '\'\'\'\'', 4000);
    }

    function showLogin() {
      document.getElementById('\''login-form'\'').classList.remove('\''hidden'\'');
      document.getElementById('\''register-form'\'').classList.add('\''hidden'\'');
    }

    function showRegister() {
      document.getElementById('\''login-form'\'').classList.add('\''hidden'\'');
      document.getElementById('\''register-form'\'').classList.remove('\''hidden'\'');
    }

    function showDashboard(user) {
      currentUser = user;
      document.getElementById('\''auth-section'\'').style.display = '\''none'\'';
      document.getElementById('\''dashboard-section'\'').style.display = '\''block'\'';
    }

    function showAuth() {
      document.getElementById('\''auth-section'\'').style.display = '\''block'\'';
      document.getElementById('\''dashboard-section'\'').style.display = '\''none'\'';
      currentUser = null;
    }

    async function checkAuth() {
      try {
        const response = await fetch('\''/api/auth/user'\'');
        if (response.ok) {
          const user = await response.json();
          showDashboard(user);
          return true;
        }
      } catch (error) {
        console.log('\''Not authenticated'\'');
      }
      return false;
    }

    window.logout = async function() {
      try {
        await fetch('\''/api/auth/logout'\'', { method: '\''POST'\'' });
        showMessage('\''Signed out successfully'\'');
        showAuth();
      } catch (error) {
        showMessage('\''Sign out failed'\'', true);
      }
    };

    window.showLogin = showLogin;
    window.showRegister = showRegister;

    document.getElementById('\''loginForm'\'').addEventListener('\''submit'\'', async (e) => {
      e.preventDefault();
      const username = document.getElementById('\''loginUsername'\'').value;
      const password = document.getElementById('\''loginPassword'\'').value;

      try {
        const response = await fetch('\''/api/auth/login'\'', {
          method: '\''POST'\'',
          headers: { '\''Content-Type'\'': '\''application/json'\'' },
          body: JSON.stringify({ username, password })
        });

        if (response.ok) {
          const user = await response.json();
          showMessage('\''Welcome back, '\'' + user.username + '\''!'\'');
          setTimeout(() => showDashboard(user), 1000);
        } else {
          const error = await response.text();
          showMessage(error || '\''Sign in failed'\'', true);
        }
      } catch (error) {
        showMessage('\''Connection error'\'', true);
      }
    });

    document.getElementById('\''registerForm'\'').addEventListener('\''submit'\'', async (e) => {
      e.preventDefault();
      const username = document.getElementById('\''regUsername'\'').value;
      const email = document.getElementById('\''regEmail'\'').value;
      const password = document.getElementById('\''regPassword'\'').value;

      try {
        const response = await fetch('\''/api/auth/register'\'', {
          method: '\''POST'\'',
          headers: { '\''Content-Type'\'': '\''application/json'\'' },
          body: JSON.stringify({ username, email, password })
        });

        if (response.ok) {
          const user = await response.json();
          showMessage('\''Account created for '\'' + user.username + '\''!'\'');
          setTimeout(() => showDashboard(user), 1000);
        } else {
          const error = await response.text();
          showMessage(error || '\''Registration failed'\'', true);
        }
      } catch (error) {
        showMessage('\''Connection error'\'', true);
      }
    });

    checkAuth();
  </script>
</body>
</html>`;

app.get('\''/'\'', (req, res) => {
  res.setHeader('\''Content-Type'\'', '\''text/html; charset=utf-8'\'');
  res.send(htmlApp);
});

app.get('\''*'\'', (req, res) => {
  if (req.path.startsWith('\''/api/'\'')) {
    return res.status(404).json({ error: '\''API endpoint not found'\'' });
  }
  res.setHeader('\''Content-Type'\'', '\''text/html; charset=utf-8'\'');
  res.send(htmlApp);
});

app.listen(port, '\''0.0.0.0'\'', () => {
  console.log(`Season Ticket Manager running on port ${port}`);
  console.log(`Platform: QNAP LXD Container`);
  console.log(`Access: http://your-qnap-ip:5050`);
});
EOF' ticketmgr

# Create systemd service
echo "Creating systemd service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << '\''EOF'\''
[Unit]
Description=Season Ticket Manager
After=network.target

[Service]
Type=simple
User=ticketmgr
WorkingDirectory=/opt/season-ticket-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050

[Install]
WantedBy=multi-user.target
EOF'

# Enable and start the service
echo "Starting Season Ticket Manager service..."
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait for service to start
sleep 5

# Check service status
echo "Checking service status..."
if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "✅ Season Ticket Manager service is running"
else
    echo "❌ Service failed to start. Checking logs..."
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20
    exit 1
fi

# Get QNAP IP address
QNAP_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "Container Name: $CONTAINER_NAME"
echo "Application URL: http://$QNAP_IP:$APP_PORT"
echo "Health Check: http://$QNAP_IP:$APP_PORT/api/health"
echo "Memory Limit: $MEMORY_LIMIT"
echo "CPU Limit: $CPU_LIMIT"
echo ""
echo "Management Commands:"
echo "  Start:   lxc start $CONTAINER_NAME"
echo "  Stop:    lxc stop $CONTAINER_NAME"
echo "  Status:  lxc list"
echo "  Logs:    lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "  Shell:   lxc exec $CONTAINER_NAME -- bash"
echo ""
echo "The Season Ticket Manager is now running on your QNAP LXD container!"