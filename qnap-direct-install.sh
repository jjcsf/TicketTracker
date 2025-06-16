#!/bin/bash

# Direct QNAP installation - no containers
set -e

APP_DIR="/share/Web/season-ticket-manager"
APP_PORT="8888"

echo "Installing Season Ticket Manager directly on QNAP..."

# Create application directory
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    # Download and install Node.js for QNAP
    wget -O nodejs.tar.xz https://nodejs.org/dist/v18.19.0/node-v18.19.0-linux-x64.tar.xz
    tar -xf nodejs.tar.xz
    mv node-v18.19.0-linux-x64 nodejs
    export PATH="$APP_DIR/nodejs/bin:$PATH"
    ln -sf "$APP_DIR/nodejs/bin/node" /usr/local/bin/node 2>/dev/null || true
    ln -sf "$APP_DIR/nodejs/bin/npm" /usr/local/bin/npm 2>/dev/null || true
    rm nodejs.tar.xz
fi

# Create package.json
cat > package.json << 'EOF'
{
  "name": "season-ticket-manager",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies
npm install

# Create the server application
cat > server.js << 'EOF'
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8888;

// Data file path
const dataFile = path.join(__dirname, 'data.json');

// Initialize data
let data = {
    users: { admin: { username: 'admin', password: 'admin123', email: 'admin@qnap.local' } },
    teams: [{ id: 1, name: 'Home Team', createdAt: new Date().toISOString() }],
    seasons: [{ id: 1, teamId: 1, year: 2025, createdAt: new Date().toISOString() }],
    games: [
        { id: 1, seasonId: 1, date: '2025-01-15', opponent: 'Team A', isHome: true, venue: 'Home Stadium' },
        { id: 2, seasonId: 1, date: '2025-01-22', opponent: 'Team B', isHome: false, venue: 'Away Stadium' },
        { id: 3, seasonId: 1, date: '2025-01-29', opponent: 'Team C', isHome: true, venue: 'Home Stadium' }
    ],
    ticketHolders: [
        { id: 1, name: 'John Smith', email: 'john@example.com', notes: 'VIP member' },
        { id: 2, name: 'Sarah Johnson', email: 'sarah@example.com', notes: 'Season ticket holder' },
        { id: 3, name: 'Mike Davis', email: 'mike@example.com', notes: 'Corporate account' }
    ],
    seats: [
        { id: 1, section: 'A', row: '1', number: '1', licenseCost: 1000 },
        { id: 2, section: 'A', row: '1', number: '2', licenseCost: 1000 },
        { id: 3, section: 'B', row: '2', number: '5', licenseCost: 1200 }
    ],
    payments: [
        { id: 1, ticketHolderId: 1, amount: 1000, type: 'from_owner', date: '2025-01-01', description: 'Seat license' },
        { id: 2, ticketHolderId: 2, amount: 1000, type: 'from_owner', date: '2025-01-01', description: 'Seat license' },
        { id: 3, ticketHolderId: 3, amount: 1200, type: 'from_owner', date: '2025-01-01', description: 'Seat license' }
    ]
};

// Load data from file if exists
try {
    if (fs.existsSync(dataFile)) {
        data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }
} catch (error) {
    console.log('Using default data');
}

// Save data to file
function saveData() {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Simple session storage
let sessions = new Map();

// Auth middleware
function requireAuth(req, res, next) {
    const sessionId = req.headers['x-session-id'] || req.headers['authorization'];
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = sessions.get(sessionId);
    next();
}

// Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = data.users[username];
    
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const sessionId = Date.now().toString() + Math.random().toString(36);
    sessions.set(sessionId, { username: user.username, email: user.email });
    
    res.json({ 
        success: true, 
        sessionId,
        user: { username: user.username, email: user.email }
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        platform: 'QNAP Direct',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/api/dashboard/stats', requireAuth, (req, res) => {
    const totalRevenue = data.payments.filter(p => p.type === 'from_owner').reduce((sum, p) => sum + p.amount, 0);
    const totalCosts = data.payments.filter(p => p.type === 'to_team').reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
        totalRevenue: totalRevenue.toFixed(2),
        totalCosts: totalCosts.toFixed(2),
        totalProfit: (totalRevenue - totalCosts).toFixed(2),
        totalGames: data.games.length,
        ticketHolders: data.ticketHolders.length,
        activeSeats: data.seats.length
    });
});

app.get('/api/teams', requireAuth, (req, res) => res.json(data.teams));
app.get('/api/seasons', requireAuth, (req, res) => res.json(data.seasons));
app.get('/api/games', requireAuth, (req, res) => res.json(data.games));
app.get('/api/ticket-holders', requireAuth, (req, res) => res.json(data.ticketHolders));
app.get('/api/seats', requireAuth, (req, res) => res.json(data.seats));
app.get('/api/payments', requireAuth, (req, res) => res.json(data.payments));

app.post('/api/games', requireAuth, (req, res) => {
    const { date, opponent, isHome, venue, time } = req.body;
    const newGame = {
        id: Math.max(...data.games.map(g => g.id), 0) + 1,
        seasonId: 1,
        date,
        opponent,
        isHome: isHome === true || isHome === 'true',
        venue,
        time
    };
    data.games.push(newGame);
    saveData();
    res.status(201).json(newGame);
});

app.post('/api/ticket-holders', requireAuth, (req, res) => {
    const { name, email, notes } = req.body;
    const newHolder = {
        id: Math.max(...data.ticketHolders.map(h => h.id), 0) + 1,
        name,
        email,
        notes
    };
    data.ticketHolders.push(newHolder);
    saveData();
    res.status(201).json(newHolder);
});

app.delete('/api/games/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    data.games = data.games.filter(g => g.id !== id);
    saveData();
    res.json({ success: true });
});

app.delete('/api/ticket-holders/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    data.ticketHolders = data.ticketHolders.filter(h => h.id !== id);
    saveData();
    res.json({ success: true });
});

// Frontend
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
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
            const [username, setUsername] = useState('');
            const [password, setPassword] = useState('');
            const [loading, setLoading] = useState(false);

            const handleSubmit = async (e) => {
                e.preventDefault();
                setLoading(true);
                try {
                    const response = await fetch('/api/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem('sessionId', data.sessionId);
                        onLogin(data.user, data.sessionId);
                    } else {
                        alert('Invalid credentials');
                    }
                } catch (error) {
                    alert('Login failed');
                } finally {
                    setLoading(false);
                }
            };

            return h('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4' },
                h('div', { className: 'bg-white rounded-2xl shadow-xl p-8 w-full max-w-md' },
                    h('div', { className: 'text-center mb-8' },
                        h('h1', { className: 'text-3xl font-bold text-gray-900 mb-2' }, 'Season Ticket Manager'),
                        h('p', { className: 'text-gray-600' }, 'QNAP Direct Installation')
                    ),
                    h('form', { onSubmit: handleSubmit, className: 'space-y-6' },
                        h('div', null,
                            h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Username'),
                            h('input', {
                                type: 'text',
                                value: username,
                                onChange: (e) => setUsername(e.target.value),
                                className: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                                required: true
                            })
                        ),
                        h('div', null,
                            h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Password'),
                            h('input', {
                                type: 'password',
                                value: password,
                                onChange: (e) => setPassword(e.target.value),
                                className: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                                required: true
                            })
                        ),
                        h('button', {
                            type: 'submit',
                            disabled: loading,
                            className: 'w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors'
                        }, loading ? 'Signing in...' : 'Sign In')
                    ),
                    h('div', { className: 'mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600' },
                        h('div', { className: 'font-medium mb-2' }, 'Default Credentials:'),
                        h('div', null, 'Username: admin'),
                        h('div', null, 'Password: admin123')
                    )
                )
            );
        }

        function Dashboard({ user, sessionId, onLogout }) {
            const [activeTab, setActiveTab] = useState('dashboard');
            const [stats, setStats] = useState(null);
            const [games, setGames] = useState([]);
            const [ticketHolders, setTicketHolders] = useState([]);
            const [loading, setLoading] = useState(true);

            const apiCall = async (url, options = {}) => {
                return fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-ID': sessionId,
                        ...options.headers
                    }
                });
            };

            const loadData = async () => {
                try {
                    const [statsRes, gamesRes, holdersRes] = await Promise.all([
                        apiCall('/api/dashboard/stats'),
                        apiCall('/api/games'),
                        apiCall('/api/ticket-holders')
                    ]);
                    
                    if (statsRes.ok) setStats(await statsRes.json());
                    if (gamesRes.ok) setGames(await gamesRes.json());
                    if (holdersRes.ok) setTicketHolders(await holdersRes.json());
                } catch (error) {
                    console.error('Error loading data:', error);
                } finally {
                    setLoading(false);
                }
            };

            useEffect(() => {
                loadData();
            }, []);

            const formatCurrency = (value) => {
                return new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: 'USD' 
                }).format(value);
            };

            const addGame = async () => {
                const date = prompt('Enter game date (YYYY-MM-DD):');
                const time = prompt('Enter game time (HH:MM):');
                const opponent = prompt('Enter opponent team:');
                const venue = prompt('Enter venue:');
                const isHome = confirm('Is this a home game?');
                
                if (date && opponent) {
                    try {
                        const response = await apiCall('/api/games', {
                            method: 'POST',
                            body: JSON.stringify({ date, time, opponent, venue, isHome })
                        });
                        if (response.ok) loadData();
                    } catch (error) {
                        alert('Error adding game');
                    }
                }
            };

            const addTicketHolder = async () => {
                const name = prompt('Enter full name:');
                const email = prompt('Enter email:');
                const notes = prompt('Enter notes (optional):');
                
                if (name && email) {
                    try {
                        const response = await apiCall('/api/ticket-holders', {
                            method: 'POST',
                            body: JSON.stringify({ name, email, notes })
                        });
                        if (response.ok) loadData();
                    } catch (error) {
                        alert('Error adding ticket holder');
                    }
                }
            };

            const deleteGame = async (id) => {
                if (confirm('Delete this game?')) {
                    try {
                        const response = await apiCall(\`/api/games/\${id}\`, { method: 'DELETE' });
                        if (response.ok) loadData();
                    } catch (error) {
                        alert('Error deleting game');
                    }
                }
            };

            const deleteTicketHolder = async (id) => {
                if (confirm('Delete this ticket holder?')) {
                    try {
                        const response = await apiCall(\`/api/ticket-holders/\${id}\`, { method: 'DELETE' });
                        if (response.ok) loadData();
                    } catch (error) {
                        alert('Error deleting ticket holder');
                    }
                }
            };

            if (loading) {
                return h('div', { className: 'min-h-screen bg-gray-50 flex items-center justify-center' },
                    h('div', { className: 'text-center' },
                        h('div', { className: 'animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4' }),
                        h('div', { className: 'text-xl text-gray-600' }, 'Loading dashboard...')
                    )
                );
            }

            const tabs = [
                { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                { id: 'games', label: 'Games', icon: '🏆' },
                { id: 'ticket-holders', label: 'Ticket Holders', icon: '👥' },
                { id: 'finances', label: 'Finances', icon: '💰' }
            ];

            return h('div', { className: 'min-h-screen bg-gray-50' },
                h('header', { className: 'bg-white shadow' },
                    h('div', { className: 'max-w-7xl mx-auto px-4 py-6' },
                        h('div', { className: 'flex justify-between items-center' },
                            h('h1', { className: 'text-3xl font-bold text-gray-900' }, 'Season Ticket Manager'),
                            h('div', { className: 'flex items-center space-x-4' },
                                h('span', { className: 'text-gray-600' }, \`Welcome, \${user.username}\`),
                                h('button', {
                                    onClick: () => {
                                        localStorage.removeItem('sessionId');
                                        onLogout();
                                    },
                                    className: 'bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700'
                                }, 'Logout')
                            )
                        )
                    )
                ),
                h('div', { className: 'max-w-7xl mx-auto px-4' },
                    h('nav', { className: 'flex space-x-8 py-4' },
                        tabs.map(tab =>
                            h('button', {
                                key: tab.id,
                                onClick: () => setActiveTab(tab.id),
                                className: \`flex items-center space-x-2 py-2 px-4 rounded-lg font-medium transition-colors \${
                                    activeTab === tab.id 
                                        ? 'bg-blue-600 text-white' 
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                }\`
                            },
                                h('span', null, tab.icon),
                                h('span', null, tab.label)
                            )
                        )
                    )
                ),
                h('main', { className: 'max-w-7xl mx-auto px-4 py-6' },
                    activeTab === 'dashboard' && stats && h('div', null,
                        h('h2', { className: 'text-2xl font-bold text-gray-900 mb-6' }, 'Dashboard Overview'),
                        h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 mb-8' },
                            [
                                { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-green-600', bg: 'bg-green-50' },
                                { label: 'Total Games', value: stats.totalGames, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Ticket Holders', value: stats.ticketHolders, color: 'text-purple-600', bg: 'bg-purple-50' }
                            ].map((stat, i) =>
                                h('div', { key: i, className: \`\${stat.bg} p-6 rounded-lg border\` },
                                    h('div', { className: \`text-2xl font-bold \${stat.color} mb-2\` }, stat.value),
                                    h('div', { className: 'text-gray-700 font-medium' }, stat.label)
                                )
                            )
                        ),
                        h('div', { className: 'bg-white p-6 rounded-lg shadow' },
                            h('h3', { className: 'text-lg font-semibold mb-4' }, 'Quick Actions'),
                            h('div', { className: 'grid grid-cols-2 gap-4' },
                                h('button', {
                                    onClick: addGame,
                                    className: 'bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700'
                                }, 'Add Game'),
                                h('button', {
                                    onClick: addTicketHolder,
                                    className: 'bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700'
                                }, 'Add Ticket Holder')
                            )
                        )
                    ),

                    activeTab === 'games' && h('div', null,
                        h('div', { className: 'flex justify-between items-center mb-6' },
                            h('h2', { className: 'text-2xl font-bold text-gray-900' }, 'Games Management'),
                            h('button', {
                                onClick: addGame,
                                className: 'bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700'
                            }, 'Add Game')
                        ),
                        h('div', { className: 'bg-white shadow rounded-lg overflow-hidden' },
                            h('table', { className: 'min-w-full' },
                                h('thead', { className: 'bg-gray-50' },
                                    h('tr', null,
                                        ['Date', 'Time', 'Opponent', 'Venue', 'Location', 'Actions'].map(header =>
                                            h('th', { 
                                                key: header,
                                                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'
                                            }, header)
                                        )
                                    )
                                ),
                                h('tbody', { className: 'bg-white divide-y divide-gray-200' },
                                    games.map(game =>
                                        h('tr', { key: game.id },
                                            h('td', { className: 'px-6 py-4 text-sm' }, game.date),
                                            h('td', { className: 'px-6 py-4 text-sm' }, game.time || 'TBD'),
                                            h('td', { className: 'px-6 py-4 text-sm font-medium' }, game.opponent),
                                            h('td', { className: 'px-6 py-4 text-sm' }, game.venue || 'TBD'),
                                            h('td', { className: 'px-6 py-4' },
                                                h('span', { 
                                                    className: \`px-2 py-1 rounded-full text-xs \${
                                                        game.isHome ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                                                    }\`
                                                }, game.isHome ? 'Home' : 'Away')
                                            ),
                                            h('td', { className: 'px-6 py-4' },
                                                h('button', {
                                                    onClick: () => deleteGame(game.id),
                                                    className: 'text-red-600 hover:text-red-800 font-medium'
                                                }, 'Delete')
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    activeTab === 'ticket-holders' && h('div', null,
                        h('div', { className: 'flex justify-between items-center mb-6' },
                            h('h2', { className: 'text-2xl font-bold text-gray-900' }, 'Ticket Holders'),
                            h('button', {
                                onClick: addTicketHolder,
                                className: 'bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700'
                            }, 'Add Holder')
                        ),
                        h('div', { className: 'bg-white shadow rounded-lg overflow-hidden' },
                            h('table', { className: 'min-w-full' },
                                h('thead', { className: 'bg-gray-50' },
                                    h('tr', null,
                                        ['Name', 'Email', 'Notes', 'Actions'].map(header =>
                                            h('th', { 
                                                key: header,
                                                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase'
                                            }, header)
                                        )
                                    )
                                ),
                                h('tbody', { className: 'bg-white divide-y divide-gray-200' },
                                    ticketHolders.map(holder =>
                                        h('tr', { key: holder.id },
                                            h('td', { className: 'px-6 py-4 text-sm font-medium' }, holder.name),
                                            h('td', { className: 'px-6 py-4 text-sm' }, holder.email),
                                            h('td', { className: 'px-6 py-4 text-sm text-gray-500' }, holder.notes || 'No notes'),
                                            h('td', { className: 'px-6 py-4' },
                                                h('button', {
                                                    onClick: () => deleteTicketHolder(holder.id),
                                                    className: 'text-red-600 hover:text-red-800 font-medium'
                                                }, 'Delete')
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    ),

                    activeTab === 'finances' && stats && h('div', null,
                        h('h2', { className: 'text-2xl font-bold text-gray-900 mb-6' }, 'Financial Overview'),
                        h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
                            [
                                { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-green-600' },
                                { label: 'Total Costs', value: formatCurrency(stats.totalCosts), color: 'text-red-600' },
                                { label: 'Net Profit', value: formatCurrency(stats.totalProfit), color: 'text-blue-600' }
                            ].map((stat, i) =>
                                h('div', { key: i, className: 'bg-white p-6 rounded-lg shadow' },
                                    h('div', { className: \`text-3xl font-bold \${stat.color} mb-2\` }, stat.value),
                                    h('div', { className: 'text-gray-700 font-medium' }, stat.label)
                                )
                            )
                        )
                    )
                )
            );
        }

        function App() {
            const [user, setUser] = useState(null);
            const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId'));

            useEffect(() => {
                if (sessionId) {
                    // Validate session by making a test API call
                    fetch('/api/health', {
                        headers: { 'X-Session-ID': sessionId }
                    }).then(response => {
                        if (response.ok) {
                            setUser({ username: 'admin' }); // Simple validation
                        } else {
                            localStorage.removeItem('sessionId');
                            setSessionId(null);
                        }
                    });
                }
            }, [sessionId]);

            if (!user) {
                return h(LoginForm, { 
                    onLogin: (userData, sessionIdData) => {
                        setUser(userData);
                        setSessionId(sessionIdData);
                    }
                });
            }

            return h(Dashboard, { 
                user, 
                sessionId, 
                onLogout: () => {
                    setUser(null);
                    setSessionId(null);
                }
            });
        }

        ReactDOM.render(h(App), document.getElementById('root'));
    </script>
</body>
</html>`);
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`Season Ticket Manager running on port ${port}`);
    console.log('Platform: QNAP Direct Installation');
    console.log('Data stored in:', dataFile);
});
EOF

# Create startup script
cat > start.sh << 'EOF'
#!/bin/bash
cd /share/Web/season-ticket-manager
export PATH="/share/Web/season-ticket-manager/nodejs/bin:$PATH"
npm start
EOF

chmod +x start.sh

# Start the application
echo "Starting Season Ticket Manager..."
nohup ./start.sh > app.log 2>&1 &
APP_PID=$!

sleep 5

# Check if running
if kill -0 $APP_PID 2>/dev/null; then
    QNAP_IP=$(hostname -I | awk '{print $1}')
    echo ""
    echo "✓ Season Ticket Manager started successfully!"
    echo ""
    echo "URL: http://$QNAP_IP:$APP_PORT"
    echo "Login: admin / admin123"
    echo ""
    echo "Application directory: $APP_DIR"
    echo "Process ID: $APP_PID"
    echo "Logs: tail -f $APP_DIR/app.log"
    echo ""
    echo "To stop: kill $APP_PID"
    echo "To restart: cd $APP_DIR && ./start.sh"
else
    echo "Failed to start application. Check logs:"
    cat app.log
fi