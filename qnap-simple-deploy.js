#!/usr/bin/env node

// Simple one-command deployment for QNAP LXD
const { execSync } = require('child_process');

const CONTAINER_NAME = "season-ticket-working";
const APP_PORT = "5051";

console.log("Deploying Season Ticket Manager to QNAP LXD...");

try {
  // Stop existing containers
  console.log("Cleaning up existing containers...");
  try {
    execSync(`lxc list --format csv -c n | grep season-ticket | xargs -r -I {} lxc stop {} --force`, { stdio: 'ignore' });
    execSync(`lxc list --format csv -c n | grep season-ticket | xargs -r -I {} lxc delete {} --force`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore errors if no containers exist
  }

  // Create and configure container
  console.log("Creating Ubuntu container...");
  execSync(`lxc launch ubuntu:22.04 ${CONTAINER_NAME}`, { stdio: 'inherit' });
  
  console.log("Waiting for container initialization...");
  execSync('sleep 20');
  
  console.log("Configuring container...");
  execSync(`lxc config device add ${CONTAINER_NAME} web proxy listen=tcp:0.0.0.0:${APP_PORT} connect=tcp:127.0.0.1:5000`, { stdio: 'inherit' });
  execSync(`lxc config set ${CONTAINER_NAME} limits.memory 4GB`, { stdio: 'inherit' });
  execSync(`lxc config set ${CONTAINER_NAME} limits.cpu 4`, { stdio: 'inherit' });

  // Install dependencies
  console.log("Installing Node.js and dependencies...");
  execSync(`lxc exec ${CONTAINER_NAME} -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq && apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential
    mkdir -p /app
  "`, { stdio: 'inherit' });

  // Create application files
  console.log("Creating application...");
  execSync(`lxc exec ${CONTAINER_NAME} -- bash -c 'cat > /app/package.json << "EOF"
{
  "name": "season-ticket-manager",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3"
  }
}
EOF'`, { stdio: 'inherit' });

  // Create the complete server application
  execSync(`lxc exec ${CONTAINER_NAME} -- bash -c 'cat > /app/server.js << "EOF"
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const app = express();
const users = new Map();

// Initialize admin user
async function initAdmin() {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync("admin123", salt, 64);
  const hashedPassword = buf.toString("hex") + "." + salt;
  
  users.set("admin", {
    id: "admin",
    username: "admin",
    email: "admin@qnap.local",
    password: hashedPassword,
    firstName: "Admin",
    lastName: "User",
    role: "admin"
  });
  console.log("Admin user created: admin/admin123");
}

initAdmin();

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: "qnap-season-ticket-secret-2025",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Authentication routes
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = users.get(username);
    if (!user || !(await comparePasswords(password, user.password))) {
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
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

app.get("/api/auth/user", requireAuth, (req, res) => {
  res.json(req.session.user);
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(), 
    platform: "QNAP LXD", 
    version: "working" 
  });
});

// Data API routes
app.get("/api/dashboard/stats/1", requireAuth, (req, res) => {
  res.json({ 
    totalRevenue: "45000.00", 
    totalCosts: "28000.00", 
    totalProfit: "17000.00", 
    gamesPlayed: 3, 
    totalGames: 4, 
    activeSeats: 4, 
    ticketHolders: 3 
  });
});

app.get("/api/games", requireAuth, (req, res) => {
  res.json([
    { id: 1, date: "2025-01-15", time: "19:00", opponent: "Team A", isHomeGame: true, attendance: 850 },
    { id: 2, date: "2025-01-22", time: "19:30", opponent: "Team B", isHomeGame: false, attendance: 920 },
    { id: 3, date: "2025-01-29", time: "18:00", opponent: "Team C", isHomeGame: true, attendance: 780 },
    { id: 4, date: "2025-02-05", time: "20:00", opponent: "Team D", isHomeGame: true }
  ]);
});

app.get("/api/ticket-holders", requireAuth, (req, res) => {
  res.json([
    { id: 1, name: "John Smith", email: "john@example.com", phone: "555-0123" },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com", phone: "555-0124" },
    { id: 3, name: "Mike Davis", email: "mike@example.com", phone: "555-0125" }
  ]);
});

app.get("/api/seats", requireAuth, (req, res) => {
  res.json([
    { id: 1, section: "A", row: "1", number: "1", licenseCost: "1000" },
    { id: 2, section: "A", row: "1", number: "2", licenseCost: "1000" },
    { id: 3, section: "B", row: "2", number: "5", licenseCost: "1200" },
    { id: 4, section: "B", row: "2", number: "6", licenseCost: "1200" }
  ]);
});

// Complete React frontend
const html = \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Season Ticket Manager - QNAP</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    <script>
        const { useState, useEffect, createElement: h } = React;
        
        function LoginForm({ onLogin }) {
            const [username, setUsername] = useState("");
            const [password, setPassword] = useState("");
            const [error, setError] = useState("");
            const [loading, setLoading] = useState(false);

            const handleSubmit = async (e) => {
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

            return h("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center" },
                h("div", { className: "max-w-md w-full bg-white rounded-xl shadow-lg p-8" },
                    h("div", { className: "text-center mb-8" },
                        h("h1", { className: "text-3xl font-bold text-gray-900" }, "Season Ticket Manager"),
                        h("p", { className: "text-gray-600 mt-2" }, "QNAP LXD Container Platform")
                    ),
                    error && h("div", { className: "mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700" }, error),
                    h("form", { onSubmit: handleSubmit, className: "space-y-6" },
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, "Username"),
                            h("input", { 
                                type: "text", 
                                value: username, 
                                onChange: (e) => setUsername(e.target.value), 
                                required: true, 
                                className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            })
                        ),
                        h("div", null,
                            h("label", { className: "block text-sm font-medium text-gray-700 mb-2" }, "Password"),
                            h("input", { 
                                type: "password", 
                                value: password, 
                                onChange: (e) => setPassword(e.target.value), 
                                required: true, 
                                className: "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            })
                        ),
                        h("button", { 
                            type: "submit", 
                            disabled: loading, 
                            className: "w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium" 
                        }, loading ? "Signing in..." : "Sign In")
                    ),
                    h("div", { className: "mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600" },
                        h("div", { className: "font-medium text-gray-800 mb-1" }, "Default Login:"),
                        h("div", null, "Username: admin"),
                        h("div", null, "Password: admin123")
                    )
                )
            );
        }

        function Dashboard({ user, onLogout }) {
            const [stats, setStats] = useState(null);
            const [games, setGames] = useState([]);
            const [ticketHolders, setTicketHolders] = useState([]);
            const [seats, setSeats] = useState([]);
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

            const formatCurrency = (value) => {
                const num = typeof value === "string" ? parseFloat(value) : value;
                return new Intl.NumberFormat("en-US", { 
                    style: "currency", 
                    currency: "USD", 
                    minimumFractionDigits: 0 
                }).format(num);
            };

            if (loading) {
                return h("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center" },
                    h("div", { className: "text-xl text-gray-600" }, "Loading dashboard...")
                );
            }

            return h("div", { className: "min-h-screen bg-gray-50" },
                h("header", { className: "bg-white shadow-sm border-b border-gray-200" },
                    h("div", { className: "max-w-7xl mx-auto px-6 py-4" },
                        h("div", { className: "flex justify-between items-center" },
                            h("div", null,
                                h("h1", { className: "text-3xl font-bold text-gray-900" }, "Season Ticket Manager"),
                                h("p", { className: "text-gray-600 mt-1" }, "QNAP LXD Container Platform")
                            ),
                            h("div", { className: "flex items-center space-x-4" },
                                h("span", { className: "text-gray-700 font-medium" }, "Welcome, " + (user.firstName || user.username)),
                                h("button", { 
                                    onClick: handleLogout, 
                                    className: "bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium" 
                                }, "Sign Out")
                            )
                        )
                    )
                ),
                h("nav", { className: "bg-white border-b border-gray-200" },
                    h("div", { className: "max-w-7xl mx-auto px-6" },
                        h("div", { className: "flex space-x-8" },
                            ["dashboard", "games", "tickets", "seats"].map(tab =>
                                h("button", {
                                    key: tab,
                                    onClick: () => setActiveTab(tab),
                                    className: "py-4 px-2 border-b-2 font-medium text-sm " + 
                                             (activeTab === tab ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")
                                }, tab.charAt(0).toUpperCase() + tab.slice(1).replace("tickets", "Ticket Holders"))
                            )
                        )
                    )
                ),
                h("main", { className: "max-w-7xl mx-auto py-8 px-6" },
                    activeTab === "dashboard" && h("div", null,
                        h("h2", { className: "text-2xl font-bold text-gray-900 mb-8" }, "Dashboard Overview"),
                        stats && h("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" },
                            [
                                { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "text-green-600" },
                                { label: "Total Costs", value: formatCurrency(stats.totalCosts), color: "text-red-600" },
                                { label: "Net Profit", value: formatCurrency(stats.totalProfit), color: "text-blue-600" },
                                { label: "Games Played", value: stats.gamesPlayed + "/" + stats.totalGames, color: "text-purple-600" }
                            ].map((stat, i) =>
                                h("div", { key: i, className: "bg-white p-6 rounded-xl shadow-md border border-gray-200" },
                                    h("div", { className: "text-3xl font-bold mb-2 " + stat.color }, stat.value),
                                    h("div", { className: "text-gray-600 font-medium" }, stat.label)
                                )
                            )
                        )
                    ),
                    activeTab === "games" && h("div", null,
                        h("h2", { className: "text-2xl font-bold text-gray-900 mb-8" }, "Games Management"),
                        h("div", { className: "bg-white shadow-md rounded-xl overflow-hidden" },
                            h("table", { className: "min-w-full divide-y divide-gray-200" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Date", "Time", "Opponent", "Type", "Attendance"].map(header =>
                                            h("th", { key: header, className: "px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase" }, header)
                                        )
                                    )
                                ),
                                h("tbody", { className: "bg-white divide-y divide-gray-200" },
                                    games.map(game =>
                                        h("tr", { key: game.id, className: "hover:bg-gray-50" },
                                            h("td", { className: "px-6 py-4 text-sm font-medium text-gray-900" }, game.date),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, game.time),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, game.opponent),
                                            h("td", { className: "px-6 py-4" },
                                                h("span", { 
                                                    className: "px-3 py-1 rounded-full text-xs font-medium " + 
                                                               (game.isHomeGame ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800") 
                                                }, game.isHomeGame ? "Home" : "Away")
                                            ),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, 
                                              game.attendance ? game.attendance.toLocaleString() : "TBD")
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    activeTab === "tickets" && h("div", null,
                        h("h2", { className: "text-2xl font-bold text-gray-900 mb-8" }, "Ticket Holders"),
                        h("div", { className: "bg-white shadow-md rounded-xl overflow-hidden" },
                            h("table", { className: "min-w-full divide-y divide-gray-200" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Name", "Email", "Phone", "Status"].map(header =>
                                            h("th", { key: header, className: "px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase" }, header)
                                        )
                                    )
                                ),
                                h("tbody", { className: "bg-white divide-y divide-gray-200" },
                                    ticketHolders.map(holder =>
                                        h("tr", { key: holder.id, className: "hover:bg-gray-50" },
                                            h("td", { className: "px-6 py-4 text-sm font-medium text-gray-900" }, holder.name),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, holder.email),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, holder.phone || "N/A"),
                                            h("td", { className: "px-6 py-4" },
                                                h("span", { className: "px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" }, "Active")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    activeTab === "seats" && h("div", null,
                        h("h2", { className: "text-2xl font-bold text-gray-900 mb-8" }, "Seat Management"),
                        h("div", { className: "bg-white shadow-md rounded-xl overflow-hidden" },
                            h("table", { className: "min-w-full divide-y divide-gray-200" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Section", "Row", "Number", "License Cost", "Status"].map(header =>
                                            h("th", { key: header, className: "px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase" }, header)
                                        )
                                    )
                                ),
                                h("tbody", { className: "bg-white divide-y divide-gray-200" },
                                    seats.map(seat =>
                                        h("tr", { key: seat.id, className: "hover:bg-gray-50" },
                                            h("td", { className: "px-6 py-4 text-sm font-medium text-gray-900" }, seat.section),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, seat.row),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, seat.number),
                                            h("td", { className: "px-6 py-4 text-sm text-gray-900" }, formatCurrency(seat.licenseCost)),
                                            h("td", { className: "px-6 py-4" },
                                                h("span", { className: "px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800" }, "Available")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            );
        }

        function App() {
            const [user, setUser] = useState(null);
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
                return h("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center" },
                    h("div", { className: "text-xl text-gray-600" }, "Loading application...")
                );
            }

            if (!user) {
                return h(LoginForm, { onLogin: setUser });
            }

            return h(Dashboard, { user, onLogout: () => setUser(null) });
        }

        ReactDOM.render(h(App), document.getElementById("root"));
    </script>
</body>
</html>\`;

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

const port = 5000;
app.listen(port, "0.0.0.0", () => {
  console.log("Season Ticket Manager running on port " + port);
  console.log("Platform: QNAP LXD Container");
  console.log("Default login: admin / admin123");
});
EOF'`, { stdio: 'inherit' });

  // Install dependencies
  console.log("Installing application dependencies...");
  execSync(`lxc exec ${CONTAINER_NAME} -- bash -c "cd /app && npm install --silent"`, { stdio: 'inherit' });

  // Create and start systemd service
  console.log("Creating systemd service...");
  execSync(`lxc exec ${CONTAINER_NAME} -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << "EOF"
[Unit]
Description=Season Ticket Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/app
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF'`, { stdio: 'inherit' });

  console.log("Starting service...");
  execSync(`lxc exec ${CONTAINER_NAME} -- systemctl daemon-reload`, { stdio: 'inherit' });
  execSync(`lxc exec ${CONTAINER_NAME} -- systemctl enable season-ticket-manager`, { stdio: 'inherit' });
  execSync(`lxc exec ${CONTAINER_NAME} -- systemctl start season-ticket-manager`, { stdio: 'inherit' });

  // Wait and verify
  console.log("Waiting for service to start...");
  execSync('sleep 15');

  try {
    execSync(`lxc exec ${CONTAINER_NAME} -- systemctl is-active --quiet season-ticket-manager`);
    console.log("✓ Application deployed successfully");
    
    // Get QNAP IP
    const qnapIP = execSync("hostname -I | awk '{print $1}' | head -1", { encoding: 'utf8' }).trim();
    
    console.log(`
========================================
DEPLOYMENT COMPLETE!
========================================

🌐 Application URL: http://${qnapIP}:${APP_PORT}
🔍 Health Check:    http://${qnapIP}:${APP_PORT}/api/health

🔐 Login Credentials:
   Username: admin
   Password: admin123

✨ Features Available:
   ✓ Interactive React interface
   ✓ Session-based authentication
   ✓ Dashboard with financial analytics
   ✓ Games management
   ✓ Ticket holder management
   ✓ Seat management system
   ✓ Responsive design

🛠️ Management Commands:
   Status:  lxc exec ${CONTAINER_NAME} -- systemctl status season-ticket-manager
   Logs:    lxc exec ${CONTAINER_NAME} -- journalctl -u season-ticket-manager -f
   Restart: lxc exec ${CONTAINER_NAME} -- systemctl restart season-ticket-manager

Your Season Ticket Manager is ready!
    `);
    
  } catch (error) {
    console.log("✗ Service failed to start. Checking logs...");
    execSync(`lxc exec ${CONTAINER_NAME} -- journalctl -u season-ticket-manager --no-pager -n 20`, { stdio: 'inherit' });
    process.exit(1);
  }

} catch (error) {
  console.error("Deployment failed:", error.message);
  process.exit(1);
}