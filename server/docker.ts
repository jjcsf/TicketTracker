import express from "express";
import { registerContainerAuthRoutes } from "./container-auth-routes";
import path from "path";

const app = express();
const port = parseInt(process.env.PORT || "5050");

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the dist/public directory
app.use(express.static(path.join(__dirname, "../dist/public")));

// Setup routes with local authentication
registerContainerAuthRoutes(app).then((server) => {
  // Serve the React app for all non-API routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/public/index.html"));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[docker] Season Ticket Manager running on port ${port}`);
    console.log(`[docker] Using local authentication system`);
    console.log(`[docker] Access at http://localhost:${port}`);
  });
});