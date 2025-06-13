import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (reqPath.startsWith("/api")) {
      let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Static file serving for production
function serveStatic(app: express.Application) {
  const publicPath = path.join(__dirname, "..", "dist", "public");
  const indexPath = path.join(publicPath, "index.html");
  
  log(`Static files path: ${publicPath}`);
  log(`Index file path: ${indexPath}`);
  
  if (process.env.NODE_ENV === "production") {
    // Check if static files exist
    try {
      const fs = require('fs');
      if (fs.existsSync(publicPath)) {
        log(`Static directory exists: ${publicPath}`);
        const files = fs.readdirSync(publicPath);
        log(`Static files: ${files.join(', ')}`);
      } else {
        log(`Static directory does not exist: ${publicPath}`);
      }
      
      if (fs.existsSync(indexPath)) {
        log(`Index file exists: ${indexPath}`);
      } else {
        log(`Index file does not exist: ${indexPath}`);
      }
    } catch (err) {
      log(`Error checking static files: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    app.use(express.static(publicPath));
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      
      res.sendFile(indexPath, (err) => {
        if (err) {
          log(`Error serving index.html: ${err.message}`);
          res.status(500).send('Application files not found');
        }
      });
    });
  }
}

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  log(`Error ${status}: ${message}`);
  res.status(status).json({ message });
});

async function startServer() {
  try {
    const server = await registerRoutes(app);
    
    // Serve static files in production
    serveStatic(app);

    const port = parseInt(process.env.PORT || "5050");
    server.listen(port, () => {
      log(`Season Ticket Manager running on port ${port}`);
    });
  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

startServer().catch((error) => {
  log(`Server startup error: ${error}`);
  process.exit(1);
});