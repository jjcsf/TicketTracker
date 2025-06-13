# Complete Setup Guide: Season Ticket Manager on QNAP Container Station with LXD

## Overview
This guide provides detailed instructions for deploying the Season Ticket Manager using LXD containers on QNAP Container Station, offering superior performance compared to Docker containers.

## Prerequisites
- QNAP NAS with Container Station installed
- SSH access to your QNAP system
- At least 2GB free RAM
- Administrative privileges

## Step 1: Enable LXD on QNAP Container Station

### 1.1 Access Container Station
1. Open QNAP web interface
2. Navigate to **Container Station**
3. Click on **Preferences** (gear icon)
4. Go to **Container Engine** tab
5. Enable **LXC/LXD** if not already enabled
6. Apply settings and restart Container Station if prompted

### 1.2 SSH Access Setup
```bash
# Connect to your QNAP via SSH
ssh admin@YOUR-QNAP-IP

# Switch to root user
sudo -i
```

### 1.3 Install and Initialize LXD
```bash
# Install LXD if not present
snap install lxd

# Initialize LXD with default settings
lxd init --auto

# Verify LXD installation
lxc version
```

## Step 2: Download Deployment Package

### 2.1 Transfer Files to QNAP
```bash
# Create directory on QNAP
mkdir -p /share/homes/admin/season-ticket-manager

# Download or transfer the deployment files
# If transferring from local machine:
scp -r lxd-qnap-package/* admin@YOUR-QNAP-IP:/share/homes/admin/season-ticket-manager/
```

### 2.2 Set Permissions
```bash
# On QNAP, set executable permissions
cd /share/homes/admin/season-ticket-manager
chmod +x deploy-lxd-qnap.sh
chmod +x manage-container.sh
```

## Step 3: Deploy the Application

### 3.1 Run Automated Deployment
```bash
# Execute the deployment script
sudo ./deploy-lxd-qnap.sh
```

The script will:
- Create Ubuntu 22.04 LXD container
- Install Node.js 20
- Deploy Season Ticket Manager application
- Configure systemd service
- Set up port forwarding on port 5050
- Apply resource limits (1GB RAM, 2 CPU cores)

### 3.2 Verify Deployment
```bash
# Check container status
lxc list

# Verify service is running
lxc exec season-ticket-manager -- systemctl status season-ticket-manager

# Test application response
curl http://localhost:5050/api/health
```

## Step 4: Manual Setup (Alternative Method)

If you prefer manual setup or the automated script fails:

### 4.1 Create Container
```bash
# Launch Ubuntu container
lxc launch ubuntu:22.04 season-ticket-manager

# Configure resources
lxc config set season-ticket-manager limits.memory 1GB
lxc config set season-ticket-manager limits.cpu 2

# Add port forwarding
lxc config device add season-ticket-manager web proxy \
    listen=tcp:0.0.0.0:5050 \
    connect=tcp:127.0.0.1:5050
```

### 4.2 Install Dependencies
```bash
# Enter container
lxc exec season-ticket-manager -- bash

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs build-essential

# Create application user
useradd -r -s /bin/bash -d /opt/season-ticket-manager ticketmgr
mkdir -p /opt/season-ticket-manager
chown -R ticketmgr:ticketmgr /opt/season-ticket-manager
```

### 4.3 Deploy Application
```bash
# Switch to application user
su - ticketmgr

# Create package.json
cat > package.json << 'EOF'
{
  "name": "season-ticket-manager-lxd",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3"
  }
}
EOF

# Install dependencies
npm install
```

### 4.4 Create Application Server
```bash
# Create main server file
cat > server.js << 'EOF'
import express from 'express';
import session from 'express-session';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const app = express();
const port = process.env.PORT || 5050;

// In-memory user storage
const users = new Map();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'qnap-lxd-session-secret',
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
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).send('Missing required fields');
    }

    if (users.has(username)) {
      return res.status(400).send('Username already exists');
    }

    const hashedPassword = await hashPassword(password);
    users.set(username, { username, email, password: hashedPassword });

    req.session.user = { username, email };
    res.json({ username, email });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send('Registration failed');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).send('Missing credentials');
    }

    const user = users.get(username);
    if (!user || !(await comparePasswords(password, user.password))) {
      return res.status(401).send('Invalid credentials');
    }

    req.session.user = { username: user.username, email: user.email };
    res.json({ username: user.username, email: user.email });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Login failed');
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send('Logout failed');
    res.sendStatus(200);
  });
});

app.get('/api/auth/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json(req.session.user);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    platform: 'QNAP LXD',
    users: users.size
  });
});

// Static HTML application
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
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message ' + (isError ? 'error' : 'success');
      setTimeout(() => msg.textContent = '', 4000);
    }

    function showLogin() {
      document.getElementById('login-form').classList.remove('hidden');
      document.getElementById('register-form').classList.add('hidden');
    }

    function showRegister() {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.remove('hidden');
    }

    function showDashboard(user) {
      currentUser = user;
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('dashboard-section').style.display = 'block';
    }

    function showAuth() {
      document.getElementById('auth-section').style.display = 'block';
      document.getElementById('dashboard-section').style.display = 'none';
      currentUser = null;
    }

    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          const user = await response.json();
          showDashboard(user);
          return true;
        }
      } catch (error) {
        console.log('Not authenticated');
      }
      return false;
    }

    window.logout = async function() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        showMessage('Signed out successfully');
        showAuth();
      } catch (error) {
        showMessage('Sign out failed', true);
      }
    };

    window.showLogin = showLogin;
    window.showRegister = showRegister;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value;
      const password = document.getElementById('loginPassword').value;

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (response.ok) {
          const user = await response.json();
          showMessage('Welcome back, ' + user.username + '!');
          setTimeout(() => showDashboard(user), 1000);
        } else {
          const error = await response.text();
          showMessage(error || 'Sign in failed', true);
        }
      } catch (error) {
        showMessage('Connection error', true);
      }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('regUsername').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPassword').value;

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });

        if (response.ok) {
          const user = await response.json();
          showMessage('Account created for ' + user.username + '!');
          setTimeout(() => showDashboard(user), 1000);
        } else {
          const error = await response.text();
          showMessage(error || 'Registration failed', true);
        }
      } catch (error) {
        showMessage('Connection error', true);
      }
    });

    checkAuth();
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(htmlApp);
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(htmlApp);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Season Ticket Manager running on port ${port}`);
  console.log(`Platform: QNAP LXD Container`);
  console.log(`Access: http://your-qnap-ip:5050`);
});
EOF
```

### 4.5 Create Systemd Service
```bash
# Exit to root user
exit

# Create systemd service file
cat > /etc/systemd/system/season-ticket-manager.service << 'EOF'
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
EOF

# Enable and start service
systemctl enable season-ticket-manager
systemctl start season-ticket-manager

# Exit container
exit
```

## Step 5: Access and Manage Container

### 5.1 Access Application
Open your web browser and navigate to:
```
http://YOUR-QNAP-IP:5050
```

### 5.2 Container Management Commands
```bash
# View container status
lxc list

# Start container
lxc start season-ticket-manager

# Stop container
lxc stop season-ticket-manager

# Restart container
lxc restart season-ticket-manager

# View application logs
lxc exec season-ticket-manager -- journalctl -u season-ticket-manager -f

# Access container shell
lxc exec season-ticket-manager -- bash

# Check service status
lxc exec season-ticket-manager -- systemctl status season-ticket-manager
```

### 5.3 Resource Management
```bash
# View current resource usage
lxc info season-ticket-manager

# Adjust memory limit
lxc config set season-ticket-manager limits.memory 2GB

# Adjust CPU limit
lxc config set season-ticket-manager limits.cpu 4

# View configuration
lxc config show season-ticket-manager
```

## Step 6: Container Station Integration

### 6.1 View in Container Station UI
1. Open Container Station in QNAP web interface
2. Navigate to **Containers** section
3. Look for **season-ticket-manager** in the LXC containers list
4. Use the interface to start/stop/monitor the container

### 6.2 Port Configuration
The container is configured to forward port 5050:
- Internal container port: 5050
- External QNAP port: 5050
- Access URL: `http://YOUR-QNAP-IP:5050`

## Step 7: Backup and Maintenance

### 7.1 Create Backup
```bash
# Stop container for consistent backup
lxc stop season-ticket-manager

# Export container
lxc export season-ticket-manager /share/backups/season-ticket-manager-backup.tar.gz

# Restart container
lxc start season-ticket-manager
```

### 7.2 Restore from Backup
```bash
# Stop and remove existing container
lxc stop season-ticket-manager
lxc delete season-ticket-manager

# Import backup
lxc import /share/backups/season-ticket-manager-backup.tar.gz --alias season-ticket-manager

# Start restored container
lxc start season-ticket-manager
```

## Troubleshooting

### Common Issues and Solutions

**Container won't start:**
```bash
# Check LXD status
lxc version
systemctl status snap.lxd.daemon

# Initialize LXD if needed
lxd init --auto
```

**Application not accessible:**
```bash
# Check service status
lxc exec season-ticket-manager -- systemctl status season-ticket-manager

# Check port forwarding
lxc config device list season-ticket-manager

# Test internal connectivity
lxc exec season-ticket-manager -- curl http://localhost:5050/api/health
```

**Resource issues:**
```bash
# Check container resources
lxc info season-ticket-manager

# Adjust limits if needed
lxc config set season-ticket-manager limits.memory 2GB
lxc config set season-ticket-manager limits.cpu 4
```

**Firewall issues:**
```bash
# Check QNAP firewall settings
# Ensure port 5050 is allowed in Container Station settings
```

## Success Verification

After successful deployment, you should:
1. See the container listed in `lxc list`
2. Access the web interface at `http://YOUR-QNAP-IP:5050`
3. Be able to register a new user account
4. Successfully log in and see the dashboard
5. Verify the health endpoint returns status information

The Season Ticket Manager is now running in a high-performance LXD container on your QNAP system with full authentication and session management capabilities.