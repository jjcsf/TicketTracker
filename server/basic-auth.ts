import { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Simple basic authentication middleware
export function setupBasicAuth(app: Express) {
  console.log("[auth] Setting up basic authentication");
  
  // Health check endpoint (no auth required)
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      environment: "development",
      authType: "basic"
    });
  });

  // Simple user endpoint that returns a mock user for development
  app.get("/api/auth/user", (req, res) => {
    // For development, return a mock user
    res.json({
      id: "dev-user",
      email: "dev@example.com",
      firstName: "Development",
      lastName: "User",
      profileImageUrl: null,
    });
  });

  console.log("[auth] Basic authentication routes registered");
}

// Simple pass-through middleware for development
export const requireAuth: RequestHandler = (req, res, next) => {
  next();
};

// Simple pass-through middleware for development
export const requireOwner: RequestHandler = (req, res, next) => {
  next();
};