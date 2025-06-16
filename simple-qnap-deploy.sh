#!/bin/bash

# Simple QNAP Season Ticket Manager Deployment
set -e

CONTAINER_NAME="season-ticket-simple"
APP_PORT="5051"

echo "Deploying Season Ticket Manager to QNAP..."

# Clean up
for container in $(lxc list --format csv -c n 2>/dev/null | grep season-ticket); do
    lxc stop "$container" --force 2>/dev/null || true
    lxc delete "$container" --force 2>/dev/null || true
done

# Create container
lxc launch ubuntu:22.04 "$CONTAINER_NAME"
sleep 20

# Configure networking
lxc config device add "$CONTAINER_NAME" web proxy listen=tcp:0.0.0.0:$APP_PORT connect=tcp:127.0.0.1:3000

# Install dependencies step by step
echo "Installing Node.js..."
lxc exec "$CONTAINER_NAME" -- bash -c '
    apt update -y
    apt install -y curl
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    node --version
    npm --version
'

echo "Creating application..."
lxc exec "$CONTAINER_NAME" -- bash -c '
    mkdir -p /app
    cd /app
    
    # Create simple package.json
    cat > package.json << EOF
{
  "name": "season-ticket-manager",
  "version": "1.0.0",
  "main": "app.js",
  "scripts": {
    "start": "node app.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

    # Install dependencies
    npm install
'

echo "Creating application server..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /app/app.js << '"'"'EOF'"'"'
const express = require("express");
const app = express();
const port = 3000;

// In-memory data
let users = new Map();
users.set("admin", {
    username: "admin",
    password: "admin123",
    email: "admin@qnap.local"
});

let teams = [
    { id: 1, name: "Home Team", createdAt: new Date().toISOString() }
];

let seasons = [
    { id: 1, teamId: 1, year: 2025, createdAt: new Date().toISOString() }
];

let games = [
    { id: 1, seasonId: 1, date: "2025-01-15", opponent: "Team A", isHome: true },
    { id: 2, seasonId: 1, date: "2025-01-22", opponent: "Team B", isHome: false },
    { id: 3, seasonId: 1, date: "2025-01-29", opponent: "Team C", isHome: true }
];

let ticketHolders = [
    { id: 1, name: "John Smith", email: "john@example.com" },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com" },
    { id: 3, name: "Mike Davis", email: "mike@example.com" }
];

app.use(express.json());
app.use(express.static("public"));

// Simple session tracking
let sessions = new Map();

// Auth middleware
function requireAuth(req, res, next) {
    const sessionId = req.headers["x-session-id"];
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: "Authentication required" });
    }
    req.user = sessions.get(sessionId);
    next();
}

// Login endpoint
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.get(username);
    
    if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const sessionId = Math.random().toString(36).substring(7);
    sessions.set(sessionId, { username: user.username, email: user.email });
    
    res.json({ 
        success: true, 
        sessionId,
        user: { username: user.username, email: user.email }
    });
});

// API endpoints
app.get("/api/health", (req, res) => {
    res.json({ 
        status: "ok", 
        platform: "QNAP LXD",
        timestamp: new Date().toISOString()
    });
});

app.get("/api/teams", requireAuth, (req, res) => res.json(teams));
app.get("/api/seasons", requireAuth, (req, res) => res.json(seasons));
app.get("/api/games", requireAuth, (req, res) => res.json(games));
app.get("/api/ticket-holders", requireAuth, (req, res) => res.json(ticketHolders));

app.post("/api/games", requireAuth, (req, res) => {
    const { date, opponent, isHome } = req.body;
    const newGame = {
        id: games.length + 1,
        seasonId: 1,
        date,
        opponent,
        isHome: isHome === true || isHome === "true"
    };
    games.push(newGame);
    res.status(201).json(newGame);
});

app.post("/api/ticket-holders", requireAuth, (req, res) => {
    const { name, email } = req.body;
    const newHolder = {
        id: ticketHolders.length + 1,
        name,
        email
    };
    ticketHolders.push(newHolder);
    res.status(201).json(newHolder);
});

// Frontend
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Season Ticket Manager - QNAP</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="root"></div>
    <script>
        const { useState, useEffect, createElement: h } = React;
        
        function App() {
            const [user, setUser] = useState(null);
            const [sessionId, setSessionId] = useState(localStorage.getItem("sessionId"));
            const [username, setUsername] = useState("");
            const [password, setPassword] = useState("");
            const [games, setGames] = useState([]);
            const [ticketHolders, setTicketHolders] = useState([]);
            const [loading, setLoading] = useState(false);
            const [activeTab, setActiveTab] = useState("dashboard");

            const apiCall = async (url, options = {}) => {
                const headers = { "Content-Type": "application/json" };
                if (sessionId) headers["X-Session-ID"] = sessionId;
                
                return fetch(url, {
                    ...options,
                    headers: { ...headers, ...options.headers }
                });
            };

            const login = async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                    const response = await fetch("/api/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username, password })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        setUser(data.user);
                        setSessionId(data.sessionId);
                        localStorage.setItem("sessionId", data.sessionId);
                        loadData();
                    } else {
                        alert("Invalid credentials");
                    }
                } catch (error) {
                    alert("Login failed");
                } finally {
                    setLoading(false);
                }
            };

            const loadData = async () => {
                try {
                    const [gamesRes, holdersRes] = await Promise.all([
                        apiCall("/api/games"),
                        apiCall("/api/ticket-holders")
                    ]);
                    
                    if (gamesRes.ok) setGames(await gamesRes.json());
                    if (holdersRes.ok) setTicketHolders(await holdersRes.json());
                } catch (error) {
                    console.error("Error loading data:", error);
                }
            };

            const addGame = async (gameData) => {
                try {
                    const response = await apiCall("/api/games", {
                        method: "POST",
                        body: JSON.stringify(gameData)
                    });
                    if (response.ok) loadData();
                } catch (error) {
                    console.error("Error adding game:", error);
                }
            };

            const addTicketHolder = async (holderData) => {
                try {
                    const response = await apiCall("/api/ticket-holders", {
                        method: "POST",
                        body: JSON.stringify(holderData)
                    });
                    if (response.ok) loadData();
                } catch (error) {
                    console.error("Error adding ticket holder:", error);
                }
            };

            useEffect(() => {
                if (sessionId && !user) {
                    loadData();
                    setUser({ username: "admin" }); // Simple session validation
                }
            }, [sessionId]);

            if (!user) {
                return h("div", { className: "min-h-screen bg-gray-100 flex items-center justify-center" },
                    h("div", { className: "bg-white p-8 rounded-lg shadow-md w-96" },
                        h("h1", { className: "text-2xl font-bold mb-6 text-center" }, "Season Ticket Manager"),
                        h("p", { className: "text-gray-600 text-center mb-6" }, "QNAP LXD Platform"),
                        h("form", { onSubmit: login, className: "space-y-4" },
                            h("input", {
                                type: "text",
                                placeholder: "Username",
                                value: username,
                                onChange: (e) => setUsername(e.target.value),
                                className: "w-full p-3 border rounded-lg",
                                required: true
                            }),
                            h("input", {
                                type: "password",
                                placeholder: "Password",
                                value: password,
                                onChange: (e) => setPassword(e.target.value),
                                className: "w-full p-3 border rounded-lg",
                                required: true
                            }),
                            h("button", {
                                type: "submit",
                                disabled: loading,
                                className: "w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            }, loading ? "Signing in..." : "Sign In")
                        ),
                        h("div", { className: "mt-4 text-sm text-gray-500 text-center" },
                            "Default: admin / admin123"
                        )
                    )
                );
            }

            return h("div", { className: "min-h-screen bg-gray-100" },
                h("header", { className: "bg-white shadow" },
                    h("div", { className: "max-w-7xl mx-auto px-4 py-6" },
                        h("div", { className: "flex justify-between items-center" },
                            h("h1", { className: "text-3xl font-bold" }, "Season Ticket Manager"),
                            h("div", { className: "flex items-center space-x-4" },
                                h("span", { className: "text-gray-600" }, \`Welcome, \${user.username}\`),
                                h("button", {
                                    onClick: () => {
                                        localStorage.removeItem("sessionId");
                                        setUser(null);
                                        setSessionId(null);
                                    },
                                    className: "bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                }, "Logout")
                            )
                        )
                    )
                ),
                h("nav", { className: "bg-white shadow-sm" },
                    h("div", { className: "max-w-7xl mx-auto px-4" },
                        h("div", { className: "flex space-x-8" },
                            ["dashboard", "games", "ticket-holders"].map(tab =>
                                h("button", {
                                    key: tab,
                                    onClick: () => setActiveTab(tab),
                                    className: \`py-4 px-2 border-b-2 font-medium text-sm \${
                                        activeTab === tab 
                                            ? "border-blue-500 text-blue-600" 
                                            : "border-transparent text-gray-500 hover:text-gray-700"
                                    }\`
                                }, tab.charAt(0).toUpperCase() + tab.slice(1).replace("-", " "))
                            )
                        )
                    )
                ),
                h("main", { className: "max-w-7xl mx-auto py-6 px-4" },
                    activeTab === "dashboard" && h("div", null,
                        h("h2", { className: "text-2xl font-bold mb-6" }, "Dashboard"),
                        h("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
                            h("div", { className: "bg-white p-6 rounded-lg shadow" },
                                h("h3", { className: "text-lg font-semibold mb-2" }, "Total Games"),
                                h("p", { className: "text-3xl font-bold text-blue-600" }, games.length)
                            ),
                            h("div", { className: "bg-white p-6 rounded-lg shadow" },
                                h("h3", { className: "text-lg font-semibold mb-2" }, "Ticket Holders"),
                                h("p", { className: "text-3xl font-bold text-green-600" }, ticketHolders.length)
                            ),
                            h("div", { className: "bg-white p-6 rounded-lg shadow" },
                                h("h3", { className: "text-lg font-semibold mb-2" }, "Platform"),
                                h("p", { className: "text-lg text-gray-600" }, "QNAP LXD")
                            )
                        )
                    ),
                    
                    activeTab === "games" && h("div", null,
                        h("div", { className: "flex justify-between items-center mb-6" },
                            h("h2", { className: "text-2xl font-bold" }, "Games"),
                            h("button", {
                                onClick: () => {
                                    const date = prompt("Enter game date (YYYY-MM-DD):");
                                    const opponent = prompt("Enter opponent:");
                                    const isHome = confirm("Is this a home game?");
                                    if (date && opponent) {
                                        addGame({ date, opponent, isHome });
                                    }
                                },
                                className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            }, "Add Game")
                        ),
                        h("div", { className: "bg-white shadow rounded-lg overflow-hidden" },
                            h("table", { className: "min-w-full" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Date", "Opponent", "Location"].map(header =>
                                            h("th", { 
                                                key: header,
                                                className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                            }, header)
                                        )
                                    )
                                ),
                                h("tbody", { className: "bg-white divide-y divide-gray-200" },
                                    games.map(game =>
                                        h("tr", { key: game.id },
                                            h("td", { className: "px-6 py-4 whitespace-nowrap" }, game.date),
                                            h("td", { className: "px-6 py-4 whitespace-nowrap" }, game.opponent),
                                            h("td", { className: "px-6 py-4 whitespace-nowrap" },
                                                h("span", { 
                                                    className: \`px-2 py-1 rounded-full text-xs \${
                                                        game.isHome ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                                                    }\`
                                                }, game.isHome ? "Home" : "Away")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    activeTab === "ticket-holders" && h("div", null,
                        h("div", { className: "flex justify-between items-center mb-6" },
                            h("h2", { className: "text-2xl font-bold" }, "Ticket Holders"),
                            h("button", {
                                onClick: () => {
                                    const name = prompt("Enter full name:");
                                    const email = prompt("Enter email:");
                                    if (name && email) {
                                        addTicketHolder({ name, email });
                                    }
                                },
                                className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            }, "Add Holder")
                        ),
                        h("div", { className: "bg-white shadow rounded-lg overflow-hidden" },
                            h("table", { className: "min-w-full" },
                                h("thead", { className: "bg-gray-50" },
                                    h("tr", null,
                                        ["Name", "Email"].map(header =>
                                            h("th", { 
                                                key: header,
                                                className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                                            }, header)
                                        )
                                    )
                                ),
                                h("tbody", { className: "bg-white divide-y divide-gray-200" },
                                    ticketHolders.map(holder =>
                                        h("tr", { key: holder.id },
                                            h("td", { className: "px-6 py-4 whitespace-nowrap font-medium" }, holder.name),
                                            h("td", { className: "px-6 py-4 whitespace-nowrap text-gray-500" }, holder.email)
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            );
        }

        ReactDOM.render(h(App), document.getElementById("root"));
    </script>
</body>
</html>`);
});

app.listen(port, "0.0.0.0", () => {
    console.log(\`Season Ticket Manager running on port \${port}\`);
    console.log("Platform: QNAP LXD Container");
    console.log("Login: admin / admin123");
});
EOF'

echo "Creating systemd service..."
lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket.service << EOF
[Unit]
Description=Season Ticket Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/app
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF'

echo "Starting service..."
lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket
lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket

sleep 10

if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket; then
    QNAP_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "✓ Season Ticket Manager deployed successfully!"
    echo ""
    echo "URL: http://$QNAP_IP:$APP_PORT"
    echo "Login: admin / admin123"
    echo ""
    echo "Management:"
    echo "  Status: lxc exec $CONTAINER_NAME -- systemctl status season-ticket"
    echo "  Logs: lxc exec $CONTAINER_NAME -- journalctl -u season-ticket -f"
else
    echo "Service failed to start. Checking logs:"
    lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket -n 20
fi