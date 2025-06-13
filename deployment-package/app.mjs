// server/minimal-container.ts
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
var scryptAsync = promisify(scrypt);
var app = express();
var port = parseInt(process.env.PORT || "5050");
var users = /* @__PURE__ */ new Map();
app.use(session({
  secret: process.env.SESSION_SECRET || "fallback-secret-key-for-testing",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    // Allow HTTP for testing
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1e3
    // 24 hours
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    message: "Season Ticket Manager API working",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    users: users.size
  });
});
var htmlApp = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Season Ticket Manager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .app { max-width: 450px; width: 90%; }
    .card { 
      background: white; 
      padding: 40px; 
      border-radius: 16px; 
      box-shadow: 0 20px 40px rgba(0,0,0,0.1);
      border: 1px solid rgba(255,255,255,0.2);
    }
    h1 { 
      text-align: center; 
      margin-bottom: 8px; 
      color: #2d3748; 
      font-size: 32px; 
      font-weight: 800; 
    }
    .subtitle { 
      text-align: center; 
      margin-bottom: 32px; 
      color: #718096; 
      font-size: 16px; 
    }
    .form-group { margin-bottom: 24px; }
    label { 
      display: block; 
      margin-bottom: 8px; 
      font-weight: 600; 
      color: #4a5568; 
      font-size: 14px; 
    }
    input { 
      width: 100%; 
      padding: 14px 16px; 
      border: 2px solid #e2e8f0; 
      border-radius: 10px; 
      font-size: 16px; 
      transition: all 0.3s ease;
      background: #f7fafc;
    }
    input:focus { 
      outline: none; 
      border-color: #667eea; 
      background: white;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    button { 
      width: 100%; 
      padding: 14px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; 
      border: none; 
      border-radius: 10px; 
      font-size: 16px; 
      font-weight: 600; 
      cursor: pointer; 
      transition: all 0.3s ease;
      margin-top: 8px; 
    }
    button:hover { 
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
    }
    button:disabled { 
      background: #cbd5e0; 
      cursor: not-allowed; 
      transform: none;
      box-shadow: none;
    }
    .toggle { 
      text-align: center; 
      margin: 24px 0 0 0; 
    }
    .toggle a { 
      color: #667eea; 
      text-decoration: none; 
      font-weight: 500; 
    }
    .toggle a:hover { text-decoration: underline; }
    .message { 
      padding: 16px; 
      border-radius: 10px; 
      margin-bottom: 24px; 
      font-size: 14px; 
      font-weight: 500;
    }
    .error { 
      background: #fed7d7; 
      color: #c53030; 
      border: 1px solid #feb2b2; 
    }
    .success { 
      background: #c6f6d5; 
      color: #2f855a; 
      border: 1px solid #9ae6b4; 
    }
    .dashboard { display: none; }
    .dashboard h2 { margin-bottom: 24px; color: #2d3748; }
    .stats { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 16px; 
      margin-bottom: 32px; 
    }
    .stat { 
      background: #f7fafc; 
      padding: 24px; 
      border-radius: 12px; 
      text-align: center; 
      border: 1px solid #e2e8f0;
    }
    .stat-value { 
      font-size: 28px; 
      font-weight: 800; 
      color: #2d3748; 
      margin-bottom: 4px;
    }
    .stat-label { 
      font-size: 12px; 
      color: #718096; 
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .welcome { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px; 
      border-radius: 12px; 
      text-align: center; 
      margin-bottom: 24px;
    }
    .logout-btn { 
      background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
      margin-top: 24px; 
    }
    .logout-btn:hover { 
      box-shadow: 0 8px 20px rgba(229, 62, 62, 0.3);
    }
    .hidden { display: none; }
    .loading { opacity: 0.6; pointer-events: none; }
  </style>
</head>
<body>
  <div class="app">
    <div id="auth-section" class="card">
      <h1>Season Ticket Manager</h1>
      <div class="subtitle">Professional ticket management platform</div>
      
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
          <a href="#" onclick="showRegister()">Create new account</a>
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
          <a href="#" onclick="showLogin()">Back to sign in</a>
        </div>
      </div>
    </div>

    <div id="dashboard-section" class="card dashboard">
      <h2>Welcome to Your Dashboard</h2>
      
      <div class="welcome">
        <h3>\u{1F3AB} Season Ticket Manager</h3>
        <p style="margin-top: 8px; opacity: 0.9;">Your authentication system is working perfectly!</p>
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
      
      <div style="background: #f7fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <p><strong>\u2705 Container Deployment Successful</strong></p>
        <p style="margin-top: 8px; color: #718096; font-size: 14px;">
          Authentication system verified and working. Ready for full feature development.
        </p>
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

    async function logout() {
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
    }

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
  </script>
</body>
</html>`;
app.get("/", (req, res) => {
  console.log("[minimal-container] Serving application");
  res.send(htmlApp);
});
app.get("*", (req, res) => {
  console.log(`[minimal-container] Catch-all route for: ${req.path}`);
  res.send(htmlApp);
});
app.use((req, res, next) => {
  console.log(`[minimal-container] ${req.method} ${req.path}`);
  next();
});
app.listen(port, "0.0.0.0", () => {
  console.log(`[minimal-container] Season Ticket Manager running on port ${port}`);
  console.log(`[minimal-container] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[minimal-container] Access at http://localhost:${port}`);
  console.log(`[minimal-container] Authentication ready - in-memory storage`);
});
