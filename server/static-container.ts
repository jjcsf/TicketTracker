import express from "express";
import path from "path";
import fs from "fs";
import { registerContainerAuthRoutes } from "./container-auth-routes";

const app = express();
const port = parseInt(process.env.PORT || "5050");

console.log('[static-container] Starting Season Ticket Manager');

// Request logging
app.use((req, res, next) => {
  console.log(`[static-container] ${req.method} ${req.path}`);
  next();
});

// Static container app with minimal dependencies
(async () => {
  try {
    // Setup authentication routes first
    const server = await registerContainerAuthRoutes(app);

    // Test route
    app.get('/api/test', (req, res) => {
      res.json({ 
        message: 'Container API is working', 
        timestamp: new Date().toISOString(),
        auth: 'local'
      });
    });

    // Create a simple index.html for container
    const containerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Season Ticket Manager</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    .form-group { margin: 15px 0; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    .error { color: red; margin: 10px 0; }
    .success { color: green; margin: 10px 0; }
    .toggle { text-align: center; margin: 20px 0; }
    .toggle a { color: #007bff; text-decoration: none; }
  </style>
</head>
<body>
  <div id="app">
    <h1>Season Ticket Manager</h1>
    <div id="auth-container">
      <div id="login-form">
        <h2>Login</h2>
        <form id="loginForm">
          <div class="form-group">
            <label>Username:</label>
            <input type="text" id="loginUsername" required>
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input type="password" id="loginPassword" required>
          </div>
          <button type="submit">Login</button>
        </form>
        <div class="toggle">
          <a href="#" onclick="showRegister()">Need an account? Register</a>
        </div>
      </div>

      <div id="register-form" style="display: none;">
        <h2>Register</h2>
        <form id="registerForm">
          <div class="form-group">
            <label>Username:</label>
            <input type="text" id="regUsername" required>
          </div>
          <div class="form-group">
            <label>Email:</label>
            <input type="email" id="regEmail" required>
          </div>
          <div class="form-group">
            <label>Password:</label>
            <input type="password" id="regPassword" required>
          </div>
          <button type="submit">Register</button>
        </form>
        <div class="toggle">
          <a href="#" onclick="showLogin()">Have an account? Login</a>
        </div>
      </div>
    </div>

    <div id="dashboard" style="display: none;">
      <h2>Dashboard</h2>
      <p>Welcome to the Season Ticket Manager!</p>
      <button onclick="logout()">Logout</button>
      <div id="dashboard-content">
        <p>Loading dashboard...</p>
      </div>
    </div>

    <div id="message"></div>
  </div>

  <script>
    function showMessage(text, isError = false) {
      const msg = document.getElementById('message');
      msg.textContent = text;
      msg.className = isError ? 'error' : 'success';
      setTimeout(() => msg.textContent = '', 5000);
    }

    function showLogin() {
      document.getElementById('login-form').style.display = 'block';
      document.getElementById('register-form').style.display = 'none';
    }

    function showRegister() {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('register-form').style.display = 'block';
    }

    function showDashboard() {
      document.getElementById('auth-container').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
    }

    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          showDashboard();
          return true;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
      return false;
    }

    async function logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        location.reload();
      } catch (error) {
        showMessage('Logout failed', true);
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
          showMessage('Login successful!');
          showDashboard();
        } else {
          const error = await response.text();
          showMessage(error || 'Login failed', true);
        }
      } catch (error) {
        showMessage('Login error: ' + error.message, true);
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
          showMessage('Registration successful!');
          showDashboard();
        } else {
          const error = await response.text();
          showMessage(error || 'Registration failed', true);
        }
      } catch (error) {
        showMessage('Registration error: ' + error.message, true);
      }
    });

    // Check if already logged in
    checkAuth();
  </script>
</body>
</html>`;

    // Serve the simple HTML for all non-API routes
    app.get('/', (req, res) => {
      console.log('[static-container] Serving authentication page');
      res.send(containerHTML);
    });

    // Catch all other routes and serve the auth page
    app.get('*', (req, res) => {
      console.log(`[static-container] Serving auth page for route: ${req.path}`);
      res.send(containerHTML);
    });

    server.listen(port, "0.0.0.0", () => {
      console.log(`[static-container] Season Ticket Manager running on port ${port}`);
      console.log(`[static-container] Access at http://localhost:${port}`);
      console.log(`[static-container] Test API at: http://localhost:${port}/api/test`);
    });

  } catch (error) {
    console.error('[static-container] Failed to start:', error);
    process.exit(1);
  }
})();