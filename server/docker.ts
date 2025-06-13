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

// Add debugging middleware to log all requests
app.use((req, res, next) => {
  console.log(`[docker] ${req.method} ${req.path}`);
  next();
});

// Setup routes with local authentication BEFORE static files
registerContainerAuthRoutes(app).then((server) => {
  // Serve static files AFTER API routes are registered
  app.use(express.static(path.join(__dirname, "public")));
  server.listen(port, "0.0.0.0", () => {
    console.log(`[docker] Season Ticket Manager running on port ${port}`);
    console.log(`[docker] Using local authentication system`);
    console.log(`[docker] Access at http://localhost:${port}`);
  });
});