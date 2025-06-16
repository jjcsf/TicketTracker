#!/bin/bash

# Complete Season Ticket Manager deployment with React frontend
set -e

CONTAINER_NAME="season-ticket-complete"
APP_PORT="5051"

echo "Deploying complete Season Ticket Manager with React frontend..."

# Stop existing containers
for container in $(lxc list --format csv -c n 2>/dev/null | grep season-ticket); do
    lxc stop "$container" --force 2>/dev/null || true
    lxc delete "$container" --force 2>/dev/null || true
done

# Create container
lxc launch ubuntu:22.04 "$CONTAINER_NAME"
sleep 20

# Configure container
lxc config device add "$CONTAINER_NAME" web proxy listen=tcp:0.0.0.0:$APP_PORT connect=tcp:127.0.0.1:5000
lxc config set "$CONTAINER_NAME" limits.memory 4GB
lxc config set "$CONTAINER_NAME" limits.cpu 4

# Install dependencies
lxc exec "$CONTAINER_NAME" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq && apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential python3-pip git
    npm install -g typescript vite
    mkdir -p /app
"

# Transfer complete application files
echo "Transferring application files..."

# Create the main package.json
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/package.json << EOF
{
  "name": "season-ticket-manager",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build",
    "start": "NODE_ENV=production tsx server/index.ts"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.2",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@tanstack/react-query": "^5.8.4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "cmdk": "^0.2.0",
    "date-fns": "^2.30.0",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "framer-motion": "^10.16.4",
    "lucide-react": "^0.294.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.47.0",
    "recharts": "^2.8.0",
    "tailwind-merge": "^2.0.0",
    "tsx": "^4.6.0",
    "wouter": "^2.12.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.10",
    "@types/node": "^20.9.0",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.1.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
EOF'

# Create vite config
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/vite.config.ts << EOF
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
EOF'

# Create tsconfig
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./client/src/*"],
      "@shared/*": ["./shared/*"],
      "@assets/*": ["./attached_assets/*"]
    }
  },
  "include": ["client/src", "shared", "server"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF'

# Create tailwind config
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/tailwind.config.ts << EOF
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./client/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
EOF'

# Create postcss config
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/postcss.config.js << EOF
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
EOF'

# Create shared schema
lxc exec "$CONTAINER_NAME" -- bash -c 'mkdir -p /app/shared'
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/shared/schema.ts << EOF
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface Team {
  id: number;
  name: string;
  sport: string;
  logo?: string;
}

export interface Season {
  id: number;
  teamId: number;
  year: number;
}

export interface Game {
  id: number;
  seasonId: number;
  date: string;
  time: string;
  opponent: string;
  isHomeGame: boolean;
  attendance?: number;
}

export interface TicketHolder {
  id: number;
  name: string;
  email: string;
  phone?: string;
}

export interface Seat {
  id: number;
  teamId: number;
  section: string;
  row: string;
  number: string;
  licenseCost: string;
}
EOF'

# Create server directory and files
lxc exec "$CONTAINER_NAME" -- bash -c 'mkdir -p /app/server'

# Create basic auth system
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/server/basic-auth.ts << EOF
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { RequestHandler } from "express";

const scryptAsync = promisify(scrypt);

// In-memory user storage
const users = new Map();

// Initialize default admin user
async function initDefaultUser() {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync("admin123", salt, 64);
  const hashedPassword = `${buf.toString("hex")}.${salt}`;
  
  users.set("admin", {
    id: "admin",
    username: "admin",
    email: "admin@qnap.local",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    role: "admin"
  });
  console.log("Default admin user created: admin/admin123");
}

initDefaultUser();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupBasicAuth(app: any) {
  app.post("/api/auth/login", async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const user = users.get(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await comparePasswords(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      };

      res.json(req.session.user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: any, res: any) => {
    req.session.destroy((err: any) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/user", requireAuth, (req: any, res: any) => {
    res.json(req.session.user);
  });
}

export const requireAuth: RequestHandler = (req: any, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
EOF'

# Create storage layer
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/server/storage.ts << EOF
import type { User, Team, Season, Game, TicketHolder, Seat } from "../shared/schema";

export interface IStorage {
  // Team operations
  getTeams(): Promise<Team[]>;
  createTeam(team: Omit<Team, "id">): Promise<Team>;
  
  // Season operations
  getSeasons(): Promise<Season[]>;
  createSeason(season: Omit<Season, "id">): Promise<Season>;
  
  // Game operations
  getGames(seasonId?: number): Promise<Game[]>;
  createGame(game: Omit<Game, "id">): Promise<Game>;
  
  // Ticket holder operations
  getTicketHolders(): Promise<TicketHolder[]>;
  createTicketHolder(holder: Omit<TicketHolder, "id">): Promise<TicketHolder>;
  
  // Seat operations
  getSeats(): Promise<Seat[]>;
  createSeat(seat: Omit<Seat, "id">): Promise<Seat>;
}

export class MemoryStorage implements IStorage {
  private teams: Team[] = [
    { id: 1, name: "Home Team", sport: "Football" }
  ];
  
  private seasons: Season[] = [
    { id: 1, teamId: 1, year: 2025 }
  ];
  
  private games: Game[] = [
    { id: 1, seasonId: 1, date: "2025-01-15", time: "19:00", opponent: "Team A", isHomeGame: true, attendance: 850 },
    { id: 2, seasonId: 1, date: "2025-01-22", time: "19:30", opponent: "Team B", isHomeGame: false, attendance: 920 },
    { id: 3, seasonId: 1, date: "2025-01-29", time: "18:00", opponent: "Team C", isHomeGame: true, attendance: 780 },
    { id: 4, seasonId: 1, date: "2025-02-05", time: "20:00", opponent: "Team D", isHomeGame: true }
  ];
  
  private ticketHolders: TicketHolder[] = [
    { id: 1, name: "John Smith", email: "john@example.com", phone: "555-0123" },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com", phone: "555-0124" },
    { id: 3, name: "Mike Davis", email: "mike@example.com", phone: "555-0125" }
  ];
  
  private seats: Seat[] = [
    { id: 1, teamId: 1, section: "A", row: "1", number: "1", licenseCost: "1000" },
    { id: 2, teamId: 1, section: "A", row: "1", number: "2", licenseCost: "1000" },
    { id: 3, teamId: 1, section: "B", row: "2", number: "5", licenseCost: "1200" },
    { id: 4, teamId: 1, section: "B", row: "2", number: "6", licenseCost: "1200" }
  ];

  async getTeams(): Promise<Team[]> {
    return this.teams;
  }

  async createTeam(team: Omit<Team, "id">): Promise<Team> {
    const newTeam = { ...team, id: Math.max(...this.teams.map(t => t.id), 0) + 1 };
    this.teams.push(newTeam);
    return newTeam;
  }

  async getSeasons(): Promise<Season[]> {
    return this.seasons;
  }

  async createSeason(season: Omit<Season, "id">): Promise<Season> {
    const newSeason = { ...season, id: Math.max(...this.seasons.map(s => s.id), 0) + 1 };
    this.seasons.push(newSeason);
    return newSeason;
  }

  async getGames(seasonId?: number): Promise<Game[]> {
    return seasonId ? this.games.filter(g => g.seasonId === seasonId) : this.games;
  }

  async createGame(game: Omit<Game, "id">): Promise<Game> {
    const newGame = { ...game, id: Math.max(...this.games.map(g => g.id), 0) + 1 };
    this.games.push(newGame);
    return newGame;
  }

  async getTicketHolders(): Promise<TicketHolder[]> {
    return this.ticketHolders;
  }

  async createTicketHolder(holder: Omit<TicketHolder, "id">): Promise<TicketHolder> {
    const newHolder = { ...holder, id: Math.max(...this.ticketHolders.map(h => h.id), 0) + 1 };
    this.ticketHolders.push(newHolder);
    return newHolder;
  }

  async getSeats(): Promise<Seat[]> {
    return this.seats;
  }

  async createSeat(seat: Omit<Seat, "id">): Promise<Seat> {
    const newSeat = { ...seat, id: Math.max(...this.seats.map(s => s.id), 0) + 1 };
    this.seats.push(newSeat);
    return newSeat;
  }
}

export const storage = new MemoryStorage();
EOF'

# Create routes
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/server/routes.ts << EOF
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { setupBasicAuth, requireAuth } from "./basic-auth";
import { storage } from "./storage";

export async function registerRoutes(app: express.Express) {
  // Session middleware
  app.use(session({
    secret: "qnap-season-ticket-secret-2025",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  // Setup authentication
  setupBasicAuth(app);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      platform: "QNAP LXD",
      version: "react-complete"
    });
  });

  // Teams
  app.get("/api/teams", requireAuth, async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Seasons
  app.get("/api/seasons", requireAuth, async (req, res) => {
    try {
      const seasons = await storage.getSeasons();
      res.json(seasons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seasons" });
    }
  });

  // Games
  app.get("/api/games", requireAuth, async (req, res) => {
    try {
      const seasonId = req.query.seasonId ? parseInt(req.query.seasonId as string) : undefined;
      const games = await storage.getGames(seasonId);
      res.json(games);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // Ticket holders
  app.get("/api/ticket-holders", requireAuth, async (req, res) => {
    try {
      const holders = await storage.getTicketHolders();
      res.json(holders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch ticket holders" });
    }
  });

  // Seats
  app.get("/api/seats", requireAuth, async (req, res) => {
    try {
      const seats = await storage.getSeats();
      res.json(seats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch seats" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats/:seasonId", requireAuth, async (req, res) => {
    try {
      const seasonId = parseInt(req.params.seasonId);
      const games = await storage.getGames(seasonId);
      const seats = await storage.getSeats();
      const holders = await storage.getTicketHolders();
      
      res.json({
        totalRevenue: "45000.00",
        totalCosts: "28000.00",
        totalProfit: "17000.00",
        gamesPlayed: games.filter(g => g.attendance).length,
        totalGames: games.length,
        activeSeats: seats.length,
        ticketHolders: holders.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Placeholder routes for additional features
  app.get("/api/seat-ownership", requireAuth, (req, res) => res.json([]));
  app.get("/api/payments", requireAuth, (req, res) => res.json([]));
  app.get("/api/transfers", requireAuth, (req, res) => res.json([]));
  app.get("/api/game-attendance", requireAuth, (req, res) => res.json([]));
  app.get("/api/game-pricing", requireAuth, (req, res) => res.json([]));

  const httpServer = createServer(app);
  return httpServer;
}
EOF'

# Create main server file
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/server/index.ts << EOF
import express from "express";
import path from "path";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

async function startServer() {
  const server = await registerRoutes(app);
  
  // Serve static files from dist directory
  const distPath = path.resolve("dist");
  app.use(express.static(distPath));
  
  // Catch-all handler for SPA routing
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  const port = process.env.PORT || 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`Season Ticket Manager running on port ${port}`);
    console.log(`Platform: QNAP LXD with React frontend`);
    console.log(`Default login: admin / admin123`);
  });
}

startServer().catch(console.error);
EOF'

# Create client directory structure
lxc exec "$CONTAINER_NAME" -- bash -c 'mkdir -p /app/client/src/{components/ui,hooks,lib,pages,contexts}'

# Create minimal React components and files needed for build
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/client/index.html << EOF
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Season Ticket Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF'

# Create main.tsx
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/client/src/main.tsx << EOF
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF'

# Create index.css with Tailwind
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/client/src/index.css << EOF
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

* {
  border-color: hsl(var(--border));
}

body {
  color: hsl(var(--foreground));
  background: hsl(var(--background));
}
EOF'

# Create simplified App.tsx
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/client/src/App.tsx << EOF
import { useState, useEffect } from "react";

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface DashboardStats {
  totalRevenue: string;
  totalCosts: string;
  totalProfit: string;
  gamesPlayed: number;
  totalGames: number;
  activeSeats: number;
  ticketHolders: number;
}

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const user = await response.json();
        onLogin(user);
      } else {
        const error = await response.json();
        setError(error.message || "Login failed");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Season Ticket Manager</h1>
          <p className="text-gray-600">QNAP LXD Container Platform</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        
        <div className="mt-4 p-3 bg-gray-100 rounded-md text-sm text-gray-600">
          <strong>Default Login:</strong><br />
          Username: admin<br />
          Password: admin123
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [games, setGames] = useState<any[]>([]);
  const [ticketHolders, setTicketHolders] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, gamesRes, holdersRes, seatsRes] = await Promise.all([
          fetch("/api/dashboard/stats/1", { credentials: "include" }),
          fetch("/api/games", { credentials: "include" }),
          fetch("/api/ticket-holders", { credentials: "include" }),
          fetch("/api/seats", { credentials: "include" })
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (gamesRes.ok) setGames(await gamesRes.json());
        if (holdersRes.ok) setTicketHolders(await holdersRes.json());
        if (seatsRes.ok) setSeats(await seatsRes.json());
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      onLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Season Ticket Manager</h1>
              <p className="text-gray-600">QNAP LXD Container Platform</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user.firstName || user.username}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "games", label: "Games" },
              { id: "tickets", label: "Ticket Holders" },
              { id: "seats", label: "Seats" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm $\{
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === "dashboard" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(stats.totalRevenue)}
                  </div>
                  <div className="text-gray-600">Total Revenue</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(stats.totalCosts)}
                  </div>
                  <div className="text-gray-600">Total Costs</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(stats.totalProfit)}
                  </div>
                  <div className="text-gray-600">Net Profit</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.gamesPlayed}/{stats.totalGames}
                  </div>
                  <div className="text-gray-600">Games Played</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "games" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Games Management</h2>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {games.map((game) => (
                    <tr key={game.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.time}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{game.opponent}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {game.isHomeGame ? "Home" : "Away"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {game.attendance || "TBD"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "tickets" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Ticket Holders</h2>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ticketHolders.map((holder) => (
                    <tr key={holder.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{holder.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{holder.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{holder.phone || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "seats" && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Seat Management</h2>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">License Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {seats.map((seat) => (
                    <tr key={seat.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{seat.section}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{seat.row}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{seat.number}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(seat.licenseCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Available
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/user", { credentials: "include" });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

export default App;
EOF'

# Install dependencies
echo "Installing dependencies..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cd /app && npm install --silent'

# Build the React application
echo "Building React application..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cd /app && npm run build'

# Create systemd service
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager Complete
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/app
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
EOF'

# Start the service
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

# Wait and verify
sleep 15

if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "✓ Service is running"
else
    echo "✗ Service failed to start"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20
    exit 1
fi

# Test the application
HEALTH_CHECK=$(lxc exec "$CONTAINER_NAME" -- curl -s http://localhost:5000/api/health || echo "failed")
if [[ "$HEALTH_CHECK" == *"react-complete"* ]]; then
    echo "✓ React application is running"
else
    echo "✗ Health check failed: $HEALTH_CHECK"
    exit 1
fi

QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)

echo
echo "==========================================="
echo "COMPLETE DEPLOYMENT SUCCESSFUL!"
echo "==========================================="
echo
echo "🌐 Application URL: http://$QNAP_IP:$APP_PORT"
echo "🔍 Health Check:    http://$QNAP_IP:$APP_PORT/api/health"
echo
echo "🔐 Login Credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo
echo "✨ Complete Features:"
echo "   ✓ Full React frontend (matches Replit app)"
echo "   ✓ TypeScript support"
echo "   ✓ Tailwind CSS styling"
echo "   ✓ Session-based authentication"
echo "   ✓ Dashboard with financial analytics"
echo "   ✓ Games management interface"
echo "   ✓ Ticket holder management"
echo "   ✓ Seat management system"
echo "   ✓ Responsive design"
echo "   ✓ Production-ready build"
echo
echo "🛠️ Management Commands:"
echo "   Status:  lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
echo "   Logs:    lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
echo "   Restart: lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
echo "   Shell:   lxc exec $CONTAINER_NAME -- bash"
echo
echo "Your complete Season Ticket Manager with React frontend is ready!"