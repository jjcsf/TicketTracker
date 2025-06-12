// Simple Node.js production server with authentication bypass
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Basic logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${new Date().toLocaleTimeString()} [express] ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Authentication bypass for container deployment
app.get('/api/auth/user', (req, res) => {
  res.json({
    id: 'container-user',
    email: 'admin@container.local',
    firstName: 'Container',
    lastName: 'Admin'
  });
});

// Authentication bypass routes
app.get('/api/login', (req, res) => {
  res.redirect('/');
});

app.get('/api/logout', (req, res) => {
  res.redirect('/');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Container deployment is running' });
});

// Database status (mock for now)
app.get('/api/seasons', (req, res) => {
  res.json([]);
});

app.get('/api/teams', (req, res) => {
  res.json([]);
});

app.get('/api/games', (req, res) => {
  res.json([]);
});

app.get('/api/ticket-holders', (req, res) => {
  res.json([]);
});

app.get('/api/seats', (req, res) => {
  res.json([]);
});

// Serve static files
const clientDistPath = path.resolve('client/dist');
app.use(express.static(clientDistPath));

// Catch-all for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(500).send('Application not built. Please run npm run build first.');
    }
  });
});

const port = 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`${new Date().toLocaleTimeString()} [express] Container server running on port ${port}`);
  console.log(`${new Date().toLocaleTimeString()} [express] Access the application at http://your-nas-ip:8080`);
});