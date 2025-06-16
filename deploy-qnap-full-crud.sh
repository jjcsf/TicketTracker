#!/bin/bash

# Full CRUD Season Ticket Manager for QNAP LXD
set -e

CONTAINER_NAME="season-ticket-full"
APP_PORT="5051"

echo "Deploying Season Ticket Manager with Full CRUD functionality..."

# Clean up existing containers
for container in $(lxc list --format csv -c n 2>/dev/null | grep season-ticket); do
    lxc stop "$container" --force 2>/dev/null || true
    lxc delete "$container" --force 2>/dev/null || true
done

# Create container
lxc launch ubuntu:22.04 "$CONTAINER_NAME"
sleep 20
lxc config device add "$CONTAINER_NAME" web proxy listen=tcp:0.0.0.0:$APP_PORT connect=tcp:127.0.0.1:5000
lxc config set "$CONTAINER_NAME" limits.memory 4GB

# Install Node.js
lxc exec "$CONTAINER_NAME" -- bash -c '
    export DEBIAN_FRONTEND=noninteractive
    apt update -qq && apt upgrade -y -qq
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs build-essential
    mkdir -p /app
'

# Create package.json
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/package.json << "EOF"
{
  "name": "season-ticket-manager",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.17.3"
  }
}
EOF'

# Create full CRUD server
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/server.js << "EOF"
const express = require("express");
const session = require("express-session");
const crypto = require("crypto");
const { promisify } = require("util");

const scryptAsync = promisify(crypto.scrypt);
const app = express();
const users = new Map();

// In-memory data stores
let games = [
  { id: 1, date: "2025-01-15", time: "19:00", opponent: "Team A", isHomeGame: true, attendance: 850 },
  { id: 2, date: "2025-01-22", time: "19:30", opponent: "Team B", isHomeGame: false, attendance: 920 },
  { id: 3, date: "2025-01-29", time: "18:00", opponent: "Team C", isHomeGame: true, attendance: 780 },
  { id: 4, date: "2025-02-05", time: "20:00", opponent: "Team D", isHomeGame: true }
];

let ticketHolders = [
  { id: 1, name: "John Smith", email: "john@example.com", phone: "555-0123" },
  { id: 2, name: "Sarah Johnson", email: "sarah@example.com", phone: "555-0124" },
  { id: 3, name: "Mike Davis", email: "mike@example.com", phone: "555-0125" }
];

let seats = [
  { id: 1, section: "A", row: "1", number: "1", licenseCost: "1000" },
  { id: 2, section: "A", row: "1", number: "2", licenseCost: "1000" },
  { id: 3, section: "B", row: "2", number: "5", licenseCost: "1200" },
  { id: 4, section: "B", row: "2", number: "6", licenseCost: "1200" }
];

let nextGameId = 5;
let nextHolderId = 4;
let nextSeatId = 5;

async function initAdmin() {
  const salt = crypto.randomBytes(16).toString("hex");
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
  return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
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
    version: "full-crud" 
  });
});

// Dashboard stats
app.get("/api/dashboard/stats/1", requireAuth, (req, res) => {
  const totalRevenue = seats.reduce((sum, seat) => sum + parseFloat(seat.licenseCost), 0);
  const totalCosts = totalRevenue * 0.6; // 60% costs
  const totalProfit = totalRevenue - totalCosts;
  const gamesPlayed = games.filter(g => g.attendance).length;
  
  res.json({ 
    totalRevenue: totalRevenue.toFixed(2), 
    totalCosts: totalCosts.toFixed(2), 
    totalProfit: totalProfit.toFixed(2), 
    gamesPlayed: gamesPlayed, 
    totalGames: games.length, 
    activeSeats: seats.length, 
    ticketHolders: ticketHolders.length 
  });
});

// Games CRUD routes
app.get("/api/games", requireAuth, (req, res) => {
  res.json(games);
});

app.post("/api/games", requireAuth, (req, res) => {
  const { date, time, opponent, isHomeGame, attendance } = req.body;
  const newGame = {
    id: nextGameId++,
    date,
    time,
    opponent,
    isHomeGame: isHomeGame === true || isHomeGame === "true",
    attendance: attendance ? parseInt(attendance) : undefined
  };
  games.push(newGame);
  res.status(201).json(newGame);
});

app.put("/api/games/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const gameIndex = games.findIndex(g => g.id === id);
  if (gameIndex === -1) {
    return res.status(404).json({ message: "Game not found" });
  }
  
  const { date, time, opponent, isHomeGame, attendance } = req.body;
  games[gameIndex] = {
    ...games[gameIndex],
    date,
    time,
    opponent,
    isHomeGame: isHomeGame === true || isHomeGame === "true",
    attendance: attendance ? parseInt(attendance) : undefined
  };
  res.json(games[gameIndex]);
});

app.delete("/api/games/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const gameIndex = games.findIndex(g => g.id === id);
  if (gameIndex === -1) {
    return res.status(404).json({ message: "Game not found" });
  }
  
  games.splice(gameIndex, 1);
  res.json({ message: "Game deleted successfully" });
});

// Ticket Holders CRUD routes
app.get("/api/ticket-holders", requireAuth, (req, res) => {
  res.json(ticketHolders);
});

app.post("/api/ticket-holders", requireAuth, (req, res) => {
  const { name, email, phone } = req.body;
  const newHolder = {
    id: nextHolderId++,
    name,
    email,
    phone
  };
  ticketHolders.push(newHolder);
  res.status(201).json(newHolder);
});

app.put("/api/ticket-holders/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const holderIndex = ticketHolders.findIndex(h => h.id === id);
  if (holderIndex === -1) {
    return res.status(404).json({ message: "Ticket holder not found" });
  }
  
  const { name, email, phone } = req.body;
  ticketHolders[holderIndex] = {
    ...ticketHolders[holderIndex],
    name,
    email,
    phone
  };
  res.json(ticketHolders[holderIndex]);
});

app.delete("/api/ticket-holders/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const holderIndex = ticketHolders.findIndex(h => h.id === id);
  if (holderIndex === -1) {
    return res.status(404).json({ message: "Ticket holder not found" });
  }
  
  ticketHolders.splice(holderIndex, 1);
  res.json({ message: "Ticket holder deleted successfully" });
});

// Seats CRUD routes
app.get("/api/seats", requireAuth, (req, res) => {
  res.json(seats);
});

app.post("/api/seats", requireAuth, (req, res) => {
  const { section, row, number, licenseCost } = req.body;
  const newSeat = {
    id: nextSeatId++,
    section,
    row,
    number,
    licenseCost
  };
  seats.push(newSeat);
  res.status(201).json(newSeat);
});

app.put("/api/seats/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const seatIndex = seats.findIndex(s => s.id === id);
  if (seatIndex === -1) {
    return res.status(404).json({ message: "Seat not found" });
  }
  
  const { section, row, number, licenseCost } = req.body;
  seats[seatIndex] = {
    ...seats[seatIndex],
    section,
    row,
    number,
    licenseCost
  };
  res.json(seats[seatIndex]);
});

app.delete("/api/seats/:id", requireAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const seatIndex = seats.findIndex(s => s.id === id);
  if (seatIndex === -1) {
    return res.status(404).json({ message: "Seat not found" });
  }
  
  seats.splice(seatIndex, 1);
  res.json({ message: "Seat deleted successfully" });
});

const html = `<!DOCTYPE html>
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
                        h("p", { className: "text-gray-600 mt-2" }, "QNAP LXD Container - Full CRUD")
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

        function Modal({ isOpen, onClose, title, children }) {
            if (!isOpen) return null;

            return h("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" },
                h("div", { className: "bg-white rounded-xl p-6 w-full max-w-md max-h-screen overflow-y-auto" },
                    h("div", { className: "flex justify-between items-center mb-4" },
                        h("h3", { className: "text-lg font-semibold text-gray-900" }, title),
                        h("button", { 
                            onClick: onClose, 
                            className: "text-gray-400 hover:text-gray-600 text-xl font-bold" 
                        }, "×")
                    ),
                    children
                )
            );
        }

        function GameForm({ game, onSave, onCancel }) {
            const [formData, setFormData] = useState({
                date: game?.date || "",
                time: game?.time || "",
                opponent: game?.opponent || "",
                isHomeGame: game?.isHomeGame || false,
                attendance: game?.attendance || ""
            });

            const handleSubmit = async (e) => {
                e.preventDefault();
                try {
                    const url = game ? `/api/games/\${game.id}` : "/api/games";
                    const method = game ? "PUT" : "POST";
                    
                    const response = await fetch(url, {
                        method,
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(formData)
                    });
                    
                    if (response.ok) {
                        onSave();
                    }
                } catch (error) {
                    console.error("Error saving game:", error);
                }
            };

            return h("form", { onSubmit: handleSubmit, className: "space-y-4" },
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Date"),
                    h("input", {
                        type: "date",
                        value: formData.date,
                        onChange: (e) => setFormData({...formData, date: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Time"),
                    h("input", {
                        type: "time",
                        value: formData.time,
                        onChange: (e) => setFormData({...formData, time: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Opponent"),
                    h("input", {
                        type: "text",
                        value: formData.opponent,
                        onChange: (e) => setFormData({...formData, opponent: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "flex items-center" },
                        h("input", {
                            type: "checkbox",
                            checked: formData.isHomeGame,
                            onChange: (e) => setFormData({...formData, isHomeGame: e.target.checked}),
                            className: "mr-2"
                        }),
                        h("span", { className: "text-sm font-medium text-gray-700" }, "Home Game")
                    )
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Attendance (optional)"),
                    h("input", {
                        type: "number",
                        value: formData.attendance,
                        onChange: (e) => setFormData({...formData, attendance: e.target.value}),
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", { className: "flex space-x-3 pt-4" },
                    h("button", {
                        type: "submit",
                        className: "flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                    }, game ? "Update Game" : "Add Game"),
                    h("button", {
                        type: "button",
                        onClick: onCancel,
                        className: "flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 font-medium"
                    }, "Cancel")
                )
            );
        }

        function TicketHolderForm({ holder, onSave, onCancel }) {
            const [formData, setFormData] = useState({
                name: holder?.name || "",
                email: holder?.email || "",
                phone: holder?.phone || ""
            });

            const handleSubmit = async (e) => {
                e.preventDefault();
                try {
                    const url = holder ? `/api/ticket-holders/\${holder.id}` : "/api/ticket-holders";
                    const method = holder ? "PUT" : "POST";
                    
                    const response = await fetch(url, {
                        method,
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(formData)
                    });
                    
                    if (response.ok) {
                        onSave();
                    }
                } catch (error) {
                    console.error("Error saving ticket holder:", error);
                }
            };

            return h("form", { onSubmit: handleSubmit, className: "space-y-4" },
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Name"),
                    h("input", {
                        type: "text",
                        value: formData.name,
                        onChange: (e) => setFormData({...formData, name: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Email"),
                    h("input", {
                        type: "email",
                        value: formData.email,
                        onChange: (e) => setFormData({...formData, email: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Phone"),
                    h("input", {
                        type: "tel",
                        value: formData.phone,
                        onChange: (e) => setFormData({...formData, phone: e.target.value}),
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", { className: "flex space-x-3 pt-4" },
                    h("button", {
                        type: "submit",
                        className: "flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                    }, holder ? "Update Holder" : "Add Holder"),
                    h("button", {
                        type: "button",
                        onClick: onCancel,
                        className: "flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 font-medium"
                    }, "Cancel")
                )
            );
        }

        function SeatForm({ seat, onSave, onCancel }) {
            const [formData, setFormData] = useState({
                section: seat?.section || "",
                row: seat?.row || "",
                number: seat?.number || "",
                licenseCost: seat?.licenseCost || ""
            });

            const handleSubmit = async (e) => {
                e.preventDefault();
                try {
                    const url = seat ? `/api/seats/\${seat.id}` : "/api/seats";
                    const method = seat ? "PUT" : "POST";
                    
                    const response = await fetch(url, {
                        method,
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify(formData)
                    });
                    
                    if (response.ok) {
                        onSave();
                    }
                } catch (error) {
                    console.error("Error saving seat:", error);
                }
            };

            return h("form", { onSubmit: handleSubmit, className: "space-y-4" },
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Section"),
                    h("input", {
                        type: "text",
                        value: formData.section,
                        onChange: (e) => setFormData({...formData, section: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Row"),
                    h("input", {
                        type: "text",
                        value: formData.row,
                        onChange: (e) => setFormData({...formData, row: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "Number"),
                    h("input", {
                        type: "text",
                        value: formData.number,
                        onChange: (e) => setFormData({...formData, number: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", null,
                    h("label", { className: "block text-sm font-medium text-gray-700 mb-1" }, "License Cost"),
                    h("input", {
                        type: "number",
                        step: "0.01",
                        value: formData.licenseCost,
                        onChange: (e) => setFormData({...formData, licenseCost: e.target.value}),
                        required: true,
                        className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    })
                ),
                h("div", { className: "flex space-x-3 pt-4" },
                    h("button", {
                        type: "submit",
                        className: "flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                    }, seat ? "Update Seat" : "Add Seat"),
                    h("button", {
                        type: "button",
                        onClick: onCancel,
                        className: "flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 font-medium"
                    }, "Cancel")
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
            
            // Modal states
            const [showGameModal, setShowGameModal] = useState(false);
            const [showHolderModal, setShowHolderModal] = useState(false);
            const [showSeatModal, setShowSeatModal] = useState(false);
            const [editingItem, setEditingItem] = useState(null);

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

            useEffect(() => {
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

            const handleDelete = async (type, id) => {
                if (!confirm("Are you sure you want to delete this item?")) return;
                
                try {
                    const response = await fetch(`/api/\${type}/\${id}`, {
                        method: "DELETE",
                        credentials: "include"
                    });
                    
                    if (response.ok) {
                        loadData();
                    }
                } catch (error) {
                    console.error("Error deleting item:", error);
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
                                h("p", { className: "text-gray-600 mt-1" }, "QNAP LXD Container - Full CRUD")
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
                        h("div", { className: "flex justify-between items-center mb-8" },
                            h("h2", { className: "text-2xl font-bold text-gray-900" }, "Games Management"),
                            h("button", {
                                onClick: () => {
                                    setEditingItem(null);
                                    setShowGameModal(true);
                                },
                                className: "bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                            }, "Add Game")
                        ),
                        h("div", { className: "bg-white shadow-md rounded-xl overflow-hidden" },
                            h("table", { className: "min-w-full divide-y divide-gray-200" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Date", "Time", "Opponent", "Type", "Attendance", "Actions"].map(header =>
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
                                              game.attendance ? game.attendance.toLocaleString() : "TBD"),
                                            h("td", { className: "px-6 py-4 text-sm space-x-2" },
                                                h("button", {
                                                    onClick: () => {
                                                        setEditingItem(game);
                                                        setShowGameModal(true);
                                                    },
                                                    className: "text-blue-600 hover:text-blue-800 font-medium"
                                                }, "Edit"),
                                                h("button", {
                                                    onClick: () => handleDelete("games", game.id),
                                                    className: "text-red-600 hover:text-red-800 font-medium"
                                                }, "Delete")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    activeTab === "tickets" && h("div", null,
                        h("div", { className: "flex justify-between items-center mb-8" },
                            h("h2", { className: "text-2xl font-bold text-gray-900" }, "Ticket Holders"),
                            h("button", {
                                onClick: () => {
                                    setEditingItem(null);
                                    setShowHolderModal(true);
                                },
                                className: "bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                            }, "Add Holder")
                        ),
                        h("div", { className: "bg-white shadow-md rounded-xl overflow-hidden" },
                            h("table", { className: "min-w-full divide-y divide-gray-200" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Name", "Email", "Phone", "Status", "Actions"].map(header =>
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
                                            ),
                                            h("td", { className: "px-6 py-4 text-sm space-x-2" },
                                                h("button", {
                                                    onClick: () => {
                                                        setEditingItem(holder);
                                                        setShowHolderModal(true);
                                                    },
                                                    className: "text-blue-600 hover:text-blue-800 font-medium"
                                                }, "Edit"),
                                                h("button", {
                                                    onClick: () => handleDelete("ticket-holders", holder.id),
                                                    className: "text-red-600 hover:text-red-800 font-medium"
                                                }, "Delete")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),
                    activeTab === "seats" && h("div", null,
                        h("div", { className: "flex justify-between items-center mb-8" },
                            h("h2", { className: "text-2xl font-bold text-gray-900" }, "Seat Management"),
                            h("button", {
                                onClick: () => {
                                    setEditingItem(null);
                                    setShowSeatModal(true);
                                },
                                className: "bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
                            }, "Add Seat")
                        ),
                        h("div", { className: "bg-white shadow-md rounded-xl overflow-hidden" },
                            h("table", { className: "min-w-full divide-y divide-gray-200" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Section", "Row", "Number", "License Cost", "Status", "Actions"].map(header =>
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
                                            ),
                                            h("td", { className: "px-6 py-4 text-sm space-x-2" },
                                                h("button", {
                                                    onClick: () => {
                                                        setEditingItem(seat);
                                                        setShowSeatModal(true);
                                                    },
                                                    className: "text-blue-600 hover:text-blue-800 font-medium"
                                                }, "Edit"),
                                                h("button", {
                                                    onClick: () => handleDelete("seats", seat.id),
                                                    className: "text-red-600 hover:text-red-800 font-medium"
                                                }, "Delete")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                ),
                
                // Modals
                h(Modal, {
                    isOpen: showGameModal,
                    onClose: () => setShowGameModal(false),
                    title: editingItem ? "Edit Game" : "Add New Game"
                }, h(GameForm, {
                    game: editingItem,
                    onSave: () => {
                        setShowGameModal(false);
                        setEditingItem(null);
                        loadData();
                    },
                    onCancel: () => {
                        setShowGameModal(false);
                        setEditingItem(null);
                    }
                })),
                
                h(Modal, {
                    isOpen: showHolderModal,
                    onClose: () => setShowHolderModal(false),
                    title: editingItem ? "Edit Ticket Holder" : "Add New Ticket Holder"
                }, h(TicketHolderForm, {
                    holder: editingItem,
                    onSave: () => {
                        setShowHolderModal(false);
                        setEditingItem(null);
                        loadData();
                    },
                    onCancel: () => {
                        setShowHolderModal(false);
                        setEditingItem(null);
                    }
                })),
                
                h(Modal, {
                    isOpen: showSeatModal,
                    onClose: () => setShowSeatModal(false),
                    title: editingItem ? "Edit Seat" : "Add New Seat"
                }, h(SeatForm, {
                    seat: editingItem,
                    onSave: () => {
                        setShowSeatModal(false);
                        setEditingItem(null);
                        loadData();
                    },
                    onCancel: () => {
                        setShowSeatModal(false);
                        setEditingItem(null);
                    }
                }))
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
</html>`;

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

const port = 5000;
app.listen(port, "0.0.0.0", () => {
  console.log("Season Ticket Manager with Full CRUD running on port " + port);
  console.log("Platform: QNAP LXD Container");
  console.log("Default login: admin / admin123");
});
EOF'

# Install dependencies
lxc exec "$CONTAINER_NAME" -- bash -c "cd /app && npm install --silent"

# Create systemd service
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << "EOF"
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
EOF'

# Start service
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager

sleep 15

if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
    echo "✓ Application with Full CRUD deployed successfully"
    QNAP_IP=$(hostname -I | awk '{print $1}' | head -1)
    echo ""
    echo "========================================="
    echo "FULL CRUD DEPLOYMENT COMPLETE!"
    echo "========================================="
    echo ""
    echo "🌐 Application URL: http://$QNAP_IP:$APP_PORT"
    echo "🔍 Health Check:    http://$QNAP_IP:$APP_PORT/api/health"
    echo ""
    echo "🔐 Login Credentials:"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "✨ Full CRUD Features Available:"
    echo "   ✓ Add/Edit/Delete Games with attendance tracking"
    echo "   ✓ Add/Edit/Delete Ticket Holders with contact info"
    echo "   ✓ Add/Edit/Delete Seats with license cost management"
    echo "   ✓ Interactive modal forms for all operations"
    echo "   ✓ Real-time dashboard updates with calculated stats"
    echo "   ✓ Confirmation dialogs for delete operations"
    echo "   ✓ Form validation and error handling"
    echo ""
    echo "🛠️ Management Commands:"
    echo "   Status:  lxc exec $CONTAINER_NAME -- systemctl status season-ticket-manager"
    echo "   Logs:    lxc exec $CONTAINER_NAME -- journalctl -u season-ticket-manager -f"
    echo "   Restart: lxc exec $CONTAINER_NAME -- systemctl restart season-ticket-manager"
    echo ""
    echo "Your complete Season Ticket Management System is ready!"
else
    echo "✗ Deployment failed. Checking logs..."
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 20
fi