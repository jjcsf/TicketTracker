import express from "express";
import { registerContainerAuthRoutes } from "./container-auth-routes";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || "5050");

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CORS headers for container environment
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Add debugging middleware to log all requests
app.use((req, res, next) => {
  console.log(`[docker] ${req.method} ${req.path}`);
  next();
});

(async () => {
  try {
    // Setup routes with local authentication first
    const server = await registerContainerAuthRoutes(app);
    
    // Add debug route
    app.get('/debug', (req, res) => {
      console.log('[docker] Debug page requested');
      res.sendFile(path.join(process.cwd(), 'debug-container.html'));
    });

    // Add a simple test route before static files
    app.get('/api/test', (req, res) => {
      console.log('[docker] Test endpoint called');
      res.json({ message: 'API is working', timestamp: new Date().toISOString() });
    });
    
    // Serve static assets with debugging
    app.use('/assets', (req, res, next) => {
      console.log(`[docker] Asset requested: ${req.path}`);
      next();
    }, express.static(path.join(__dirname, "public/assets"), {
      setHeaders: (res, filePath) => {
        console.log(`[docker] Serving asset: ${filePath}`);
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      }
    }));
    
    // Then serve static files for non-API routes
    app.use(express.static(path.join(__dirname, "public")));
    
    // Start the server
    server.listen(port, "0.0.0.0", () => {
      console.log(`[docker] Season Ticket Manager running on port ${port}`);
      console.log(`[docker] Using local authentication system`);
      console.log(`[docker] Access at http://localhost:${port}`);
      console.log(`[docker] Test API at: http://localhost:${port}/api/test`);
    });
  } catch (error) {
    console.error('[docker] Failed to start server:', error);
    process.exit(1);
  }
})();