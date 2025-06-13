import express from "express";
import { registerContainerAuthRoutes } from "./container-auth-routes";

const app = express();
const port = parseInt(process.env.PORT || "5050");

console.log('[working-container] Starting Season Ticket Manager');

// Complete HTML application with authentication
const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Season Ticket Manager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; }
    .container { max-width: 400px; margin: 50px auto; padding: 20px; }
    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.07); border: 1px solid #e2e8f0; }
    h1 { text-align: center; margin-bottom: 8px; color: #1a202c; font-size: 28px; font-weight: 700; }
    .subtitle { text-align: center; margin-bottom: 32px; color: #64748b; font-size: 16px; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px; }
    input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; transition: border-color 0.2s; }
    input:focus { outline: none; border-color: #3b82f6; }
    button { width: 100%; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
    button:hover { background: #2563eb; }
    button:disabled { background: #94a3b8; cursor: not-allowed; }
    .toggle { text-align: center; margin: 24px 0 0 0; }
    .toggle a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    .toggle a:hover { text-decoration: underline; }
    .message { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
    .error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .dashboard { display: none; padding: 32px; }
    .dashboard h2 { margin-bottom: 24px; color: #1a202c; }
    .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .stat { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1a202c; }
    .stat-label { font-size: 14px; color: #64748b; margin-top: 4px; }
    .nav { display: flex; gap: 12px; margin-bottom: 24px; }
    .nav button { flex: 1; background: #f1f5f9; color: #475569; }
    .nav button.active { background: #3b82f6; color: white; }
    .logout-btn { background: #dc2626; margin-top: 24px; }
    .logout-btn:hover { background: #b91c1c; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div id="auth-section" class="card">
      <h1>Season Ticket Manager</h1>
      <div class="subtitle">Manage your season tickets and finances</div>
      
      <div id="message"></div>
      
      <div id="login-form">
        <form id="loginForm">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="loginUsername" required autocomplete="username">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="loginPassword" required autocomplete="current-password">
          </div>
          <button type="submit">Sign In</button>
        </form>
        <div class="toggle">
          <a href="#" onclick="showRegister()">Don't have an account? Register</a>
        </div>
      </div>

      <div id="register-form" class="hidden">
        <form id="registerForm">
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="regUsername" required autocomplete="username">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="regEmail" required autocomplete="email">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="regPassword" required autocomplete="new-password">
          </div>
          <button type="submit">Create Account</button>
        </form>
        <div class="toggle">
          <a href="#" onclick="showLogin()">Already have an account? Sign in</a>
        </div>
      </div>
    </div>

    <div id="dashboard-section" class="card dashboard">
      <h2>Dashboard</h2>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">$0</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat">
          <div class="stat-value">0</div>
          <div class="stat-label">Active Seats</div>
        </div>
      </div>
      
      <div class="nav">
        <button class="active">Dashboard</button>
        <button>Games</button>
        <button>Finances</button>
        <button>Reports</button>
      </div>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
        <p><strong>Welcome to Season Ticket Manager!</strong></p>
        <p style="margin-top: 8px; color: #64748b;">Your authentication is working correctly. The full application features are ready for development.</p>
      </div>
      
      <button class="logout-btn" onclick="logout()">Sign Out</button>
    </div>
  </div>

  <script>
    let currentUser = null;

    function showMessage(text, isError = false) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = 'message ' + (isError ? 'error' : 'success');
      setTimeout(() => msg.textContent = '', 5000);
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

    async function logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        showMessage('Signed out successfully');
        showAuth();
      } catch (error) {
        showMessage('Sign out failed', true);
      }
    }

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
          showMessage('Welcome back!');
          showDashboard(user);
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
          showMessage('Account created successfully!');
          showDashboard(user);
        } else {
          const error = await response.text();
          showMessage(error || 'Registration failed', true);
        }
      } catch (error) {
        showMessage('Connection error', true);
      }
    });

    // Check authentication on load
    checkAuth();
  </script>
</body>
</html>`;

// Request logging
app.use((req, res, next) => {
  console.log(`[working-container] ${req.method} ${req.path}`);
  next();
});

(async () => {
  try {
    // Setup authentication routes
    const server = await registerContainerAuthRoutes(app);
    
    // Test endpoint
    app.get('/api/test', (req, res) => {
      res.json({ 
        message: 'Season Ticket Manager API is working',
        timestamp: new Date().toISOString(),
        environment: 'container'
      });
    });

    // Serve the application
    app.get('/', (req, res) => {
      console.log('[working-container] Serving main application');
      res.send(fullHTML);
    });

    app.get('*', (req, res) => {
      console.log(`[working-container] Serving app for route: ${req.path}`);
      res.send(fullHTML);
    });

    server.listen(port, "0.0.0.0", () => {
      console.log(`[working-container] Season Ticket Manager running on port ${port}`);
      console.log(`[working-container] Access at http://localhost:${port}`);
      console.log(`[working-container] Authentication system ready`);
    });

  } catch (error) {
    console.error('[working-container] Failed to start:', error);
    process.exit(1);
  }
})();