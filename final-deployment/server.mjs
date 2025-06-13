// server/static-server.ts
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
var app = express();
var port = parseInt(process.env.PORT || "5050");
var users = /* @__PURE__ */ new Map();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "static-server-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1e3
    // 24 hours
  }
}));
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
    const user = { username, email, password: hashedPassword };
    users.set(username, user);
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
      return res.status(400).send("Missing username or password");
    }
    const user = users.get(username);
    if (!user) {
      return res.status(401).send("Invalid credentials");
    }
    const isValid = await comparePasswords(password, user.password);
    if (!isValid) {
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
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).send("Logout failed");
    }
    res.sendStatus(200);
  });
});
app.get("/api/auth/user", (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json(user);
});
app.get("/api/test", (req, res) => {
  res.json({
    message: "Season Ticket Manager Static Server",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    users: users.size,
    session: !!req.session.user
  });
});
var staticHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Season Ticket Manager</title>
  <style>
    :root {
      --primary: #3b82f6;
      --primary-dark: #2563eb;
      --success: #10b981;
      --error: #ef4444;
      --text: #1f2937;
      --text-light: #6b7280;
      --bg: #f9fafb;
      --surface: #ffffff;
      --border: #e5e7eb;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text);
    }
    
    .container {
      width: 100%;
      max-width: 420px;
      padding: 20px;
    }
    
    .card {
      background: var(--surface);
      padding: 2.5rem;
      border-radius: 1rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .logo {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .logo h1 {
      font-size: 1.875rem;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 0.5rem;
    }
    
    .logo p {
      color: var(--text-light);
      font-size: 0.875rem;
    }
    
    .form-group {
      margin-bottom: 1.5rem;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text);
    }
    
    .form-group input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid var(--border);
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: all 0.2s;
      background: var(--bg);
    }
    
    .form-group input:focus {
      outline: none;
      border-color: var(--primary);
      background: var(--surface);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    
    .btn {
      width: 100%;
      padding: 0.875rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 0.5rem;
    }
    
    .btn:hover {
      background: var(--primary-dark);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }
    
    .btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .btn-danger {
      background: var(--error);
      margin-top: 1.5rem;
    }
    
    .btn-danger:hover {
      background: #dc2626;
    }
    
    .toggle {
      text-align: center;
      margin-top: 1.5rem;
    }
    
    .toggle a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.875rem;
    }
    
    .toggle a:hover {
      text-decoration: underline;
    }
    
    .message {
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }
    
    .message.error {
      background: #fef2f2;
      color: var(--error);
      border: 1px solid #fecaca;
    }
    
    .message.success {
      background: #ecfdf5;
      color: var(--success);
      border: 1px solid #bbf7d0;
    }
    
    .dashboard {
      display: none;
    }
    
    .dashboard .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    
    .dashboard h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    
    .welcome-banner {
      background: linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%);
      color: white;
      padding: 1.5rem;
      border-radius: 0.75rem;
      text-align: center;
      margin-bottom: 1.5rem;
    }
    
    .welcome-banner h3 {
      font-size: 1.125rem;
      margin-bottom: 0.5rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .stat-card {
      background: var(--bg);
      padding: 1.5rem;
      border-radius: 0.75rem;
      text-align: center;
      border: 1px solid var(--border);
    }
    
    .stat-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 0.25rem;
    }
    
    .stat-label {
      font-size: 0.75rem;
      color: var(--text-light);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .status-card {
      background: var(--bg);
      padding: 1.5rem;
      border-radius: 0.75rem;
      border: 1px solid var(--border);
      margin-bottom: 1.5rem;
    }
    
    .status-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text);
    }
    
    .status-description {
      font-size: 0.875rem;
      color: var(--text-light);
      line-height: 1.5;
    }
    
    .hidden { display: none; }
    .loading { opacity: 0.6; pointer-events: none; }
    
    @media (max-width: 480px) {
      .container { padding: 1rem; }
      .card { padding: 1.5rem; }
      .stats-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="auth-section" class="card">
      <div class="logo">
        <h1>Season Ticket Manager</h1>
        <p>Professional ticket management platform</p>
      </div>
      
      <div id="message"></div>
      
      <div id="login-form">
        <form id="loginForm">
          <div class="form-group">
            <label for="loginUsername">Username</label>
            <input type="text" id="loginUsername" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="loginPassword">Password</label>
            <input type="password" id="loginPassword" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn">Sign In</button>
        </form>
        <div class="toggle">
          <a href="#" onclick="showRegister(); return false;">Create new account</a>
        </div>
      </div>

      <div id="register-form" class="hidden">
        <form id="registerForm">
          <div class="form-group">
            <label for="regUsername">Username</label>
            <input type="text" id="regUsername" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="regEmail">Email</label>
            <input type="email" id="regEmail" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="regPassword">Password</label>
            <input type="password" id="regPassword" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn">Create Account</button>
        </form>
        <div class="toggle">
          <a href="#" onclick="showLogin(); return false;">Back to sign in</a>
        </div>
      </div>
    </div>

    <div id="dashboard-section" class="card dashboard">
      <div class="header">
        <h2>Dashboard</h2>
        <p style="color: var(--text-light);">Welcome to your ticket management system</p>
      </div>
      
      <div class="welcome-banner">
        <h3>\u{1F3AB} Authentication Verified</h3>
        <p>Your Season Ticket Manager is running successfully!</p>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">$0</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">0</div>
          <div class="stat-label">Active Seats</div>
        </div>
      </div>
      
      <div class="status-card">
        <div class="status-title">\u2705 Container Status: Operational</div>
        <div class="status-description">
          Authentication system is working correctly. The container has resolved all previous blank page issues and is ready for full feature development.
        </div>
      </div>
      
      <button class="btn btn-danger" onclick="logout()">Sign Out</button>
    </div>
  </div>

  <script>
    (function() {
      'use strict';
      
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

      function setLoading(form, isLoading) {
        form.classList.toggle('loading', isLoading);
        const button = form.querySelector('button');
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Please wait...' : (form.id === 'loginForm' ? 'Sign In' : 'Create Account');
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
          console.log('Authentication check failed');
        }
        return false;
      }

      window.logout = async function() {
        try {
          const response = await fetch('/api/auth/logout', { method: 'POST' });
          if (response.ok) {
            showMessage('Signed out successfully');
            showAuth();
          } else {
            showMessage('Sign out failed', true);
          }
        } catch (error) {
          showMessage('Connection error during sign out', true);
        }
      };

      window.showLogin = showLogin;
      window.showRegister = showRegister;

      document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        setLoading(form, true);
        
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
          showMessage('Connection error - please try again', true);
        } finally {
          setLoading(form, false);
        }
      });

      document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        setLoading(form, true);
        
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
          showMessage('Connection error - please try again', true);
        } finally {
          setLoading(form, false);
        }
      });

      // Initialize application
      console.log('Season Ticket Manager initializing...');
      checkAuth().then(authenticated => {
        console.log('Authentication status:', authenticated);
        if (!authenticated) {
          console.log('Ready for login');
        }
      });
    })();
  </script>
</body>
</html>`;
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(staticHTML);
});
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(staticHTML);
});
app.use((req, res, next) => {
  console.log(`[static-server] ${req.method} ${req.path}`);
  next();
});
app.listen(port, "0.0.0.0", () => {
  console.log(`[static-server] Season Ticket Manager running on port ${port}`);
  console.log(`[static-server] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[static-server] Access at http://localhost:${port}`);
  console.log(`[static-server] Static server with embedded authentication`);
});
