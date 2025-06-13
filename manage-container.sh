#!/bin/bash

# Season Ticket Manager - Container Management Script

CONTAINER_NAME="season-ticket-manager"
APP_PORT="5050"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

show_usage() {
    echo "Season Ticket Manager - Container Management"
    echo "==========================================="
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  status    - Show container and service status"
    echo "  logs      - Show application logs"
    echo "  restart   - Restart the application service"
    echo "  fix       - Fix service issues"
    echo "  shell     - Open shell in container"
    echo "  stop      - Stop the container"
    echo "  start     - Start the container"
    echo "  rebuild   - Rebuild and restart everything"
    echo "  test      - Test the application"
    echo "  backup    - Backup container data"
    echo ""
}

get_qnap_ip() {
    hostname -I | awk '{print $1}' | head -1
}

check_container() {
    if ! lxc list | grep -q "$CONTAINER_NAME"; then
        print_error "Container '$CONTAINER_NAME' not found"
        return 1
    fi
    return 0
}

status_command() {
    print_info "Container Status:"
    lxc list | grep -E "(NAME|$CONTAINER_NAME)" || echo "Container not found"
    
    if check_container; then
        echo ""
        print_info "Service Status:"
        if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager 2>/dev/null; then
            print_success "Service is running"
        else
            print_error "Service is not running"
        fi
        
        echo ""
        print_info "Port Status:"
        lxc exec "$CONTAINER_NAME" -- netstat -tulpn | grep ":$APP_PORT" || print_warning "Port $APP_PORT not bound"
        
        echo ""
        QNAP_IP=$(get_qnap_ip)
        print_info "Application URL: http://$QNAP_IP:$APP_PORT"
    fi
}

logs_command() {
    if check_container; then
        print_info "Application logs (press Ctrl+C to exit):"
        lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager -f
    fi
}

restart_command() {
    if check_container; then
        print_info "Restarting application service..."
        lxc exec "$CONTAINER_NAME" -- systemctl restart season-ticket-manager
        sleep 3
        
        if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
            print_success "Service restarted successfully"
        else
            print_error "Service failed to restart"
            print_info "Checking logs..."
            lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager --no-pager -n 10
        fi
    fi
}

fix_command() {
    if check_container; then
        print_info "Fixing service issues..."
        
        # Stop service
        lxc exec "$CONTAINER_NAME" -- systemctl stop season-ticket-manager 2>/dev/null || true
        
        # Check if application files exist
        if ! lxc exec "$CONTAINER_NAME" -- test -f /opt/season-ticket-manager/server.js; then
            print_error "Application files missing. Recreating..."
            
            # Recreate application
            lxc exec "$CONTAINER_NAME" -- su -c 'cat > /opt/season-ticket-manager/server.js << '"'"'EOF'"'"'
import express from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const app = express();
const port = process.env.PORT || 5050;
const users = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "season-ticket-qnap-secret-2025",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).send("Missing required fields");
    if (users.has(username)) return res.status(400).send("Username already exists");
    
    const hashedPassword = await hashPassword(password);
    users.set(username, { username, email, password: hashedPassword });
    req.session.user = { username, email };
    res.json({ username, email });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("Registration failed");
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Missing credentials");
    
    const user = users.get(username);
    if (!user || !(await comparePasswords(password, user.password))) {
      return res.status(401).send("Invalid credentials");
    }
    
    req.session.user = { username: user.username, email: user.email };
    res.json({ username: user.username, email: user.email });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).send("Login failed");
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).send("Logout failed");
    res.sendStatus(200);
  });
});

app.get("/api/auth/user", (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: "Not authenticated" });
  res.json(req.session.user);
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "QNAP LXD Container",
    projectPath: "/share/Container/projects/SeasonTicketTracker",
    users: users.size
  });
});

const htmlApp = \`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Season Ticket Manager - QNAP</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center}.container{max-width:450px;width:90%;padding:20px}.card{background:white;padding:2.5rem;border-radius:1rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25)}.header{text-align:center;margin-bottom:2rem}.header h1{font-size:1.875rem;font-weight:800;color:#1f2937;margin-bottom:0.5rem}.header p{color:#6b7280;font-size:0.875rem}.form-group{margin-bottom:1.5rem}.form-group label{display:block;margin-bottom:0.5rem;font-weight:600;color:#374151}.form-group input{width:100%;padding:0.75rem 1rem;border:2px solid #e5e7eb;border-radius:0.5rem;font-size:1rem;transition:border-color 0.2s}.form-group input:focus{outline:none;border-color:#3b82f6}.btn{width:100%;padding:0.875rem;background:#3b82f6;color:white;border:none;border-radius:0.5rem;font-size:1rem;font-weight:600;cursor:pointer;transition:background 0.2s}.btn:hover{background:#2563eb}.btn:disabled{background:#9ca3af;cursor:not-allowed}.btn-danger{background:#ef4444;margin-top:1.5rem}.btn-danger:hover{background:#dc2626}.toggle{text-align:center;margin-top:1.5rem}.toggle a{color:#3b82f6;text-decoration:none;font-weight:500}.message{padding:1rem;border-radius:0.5rem;margin-bottom:1.5rem;font-size:0.875rem}.message.error{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}.message.success{background:#ecfdf5;color:#059669;border:1px solid #bbf7d0}.dashboard{display:none}.welcome{background:linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%);color:white;padding:1.5rem;border-radius:0.75rem;text-align:center;margin-bottom:1.5rem}.stats{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem}.stat{background:#f9fafb;padding:1.5rem;border-radius:0.75rem;text-align:center}.stat-value{font-size:1.5rem;font-weight:800;color:#1f2937}.stat-label{font-size:0.75rem;color:#6b7280;text-transform:uppercase}.project-info{background:#f0f9ff;padding:1rem;border-radius:0.5rem;border:1px solid #bae6fd;margin-bottom:1.5rem}.project-info h3{color:#0c4a6e;margin-bottom:0.5rem}.project-info p{color:#075985;font-size:0.875rem}.hidden{display:none}
</style></head><body>
<div class="container"><div id="auth-section" class="card"><div class="header"><h1>Season Ticket Manager</h1><p>QNAP LXD Container Platform</p></div>
<div id="message"></div><div id="login-form"><form id="loginForm"><div class="form-group"><label>Username</label><input type="text" id="loginUsername" required></div>
<div class="form-group"><label>Password</label><input type="password" id="loginPassword" required></div><button type="submit" class="btn">Sign In</button></form>
<div class="toggle"><a href="#" onclick="showRegister()">Create new account</a></div></div>
<div id="register-form" class="hidden"><form id="registerForm"><div class="form-group"><label>Username</label><input type="text" id="regUsername" required></div>
<div class="form-group"><label>Email</label><input type="email" id="regEmail" required></div><div class="form-group"><label>Password</label><input type="password" id="regPassword" required></div>
<button type="submit" class="btn">Create Account</button></form><div class="toggle"><a href="#" onclick="showLogin()">Back to sign in</a></div></div></div>
<div id="dashboard-section" class="card dashboard"><div class="header"><h2>Dashboard</h2><p>Season Ticket Manager</p></div>
<div class="welcome"><h3>Container Deployment Successful</h3><p>Running on QNAP LXD with optimized performance</p></div>
<div class="project-info"><h3>Project Location</h3><p>/share/Container/projects/SeasonTicketTracker</p></div>
<div class="stats"><div class="stat"><div class="stat-value">$0</div><div class="stat-label">Revenue</div></div><div class="stat"><div class="stat-value">0</div><div class="stat-label">Active Seats</div></div></div>
<button class="btn btn-danger" onclick="logout()">Sign Out</button></div></div>
<script>
let currentUser=null;function showMessage(text,isError=false){const msg=document.getElementById("message");msg.textContent=text;msg.className="message "+(isError?"error":"success");setTimeout(()=>msg.textContent="",4000)}function showLogin(){document.getElementById("login-form").classList.remove("hidden");document.getElementById("register-form").classList.add("hidden")}function showRegister(){document.getElementById("login-form").classList.add("hidden");document.getElementById("register-form").classList.remove("hidden")}function showDashboard(user){currentUser=user;document.getElementById("auth-section").style.display="none";document.getElementById("dashboard-section").style.display="block"}function showAuth(){document.getElementById("auth-section").style.display="block";document.getElementById("dashboard-section").style.display="none";currentUser=null}async function checkAuth(){try{const response=await fetch("/api/auth/user");if(response.ok){const user=await response.json();showDashboard(user);return true}}catch(error){}return false}window.logout=async function(){try{await fetch("/api/auth/logout",{method:"POST"});showMessage("Signed out successfully");showAuth()}catch(error){showMessage("Sign out failed",true)}};window.showLogin=showLogin;window.showRegister=showRegister;document.getElementById("loginForm").addEventListener("submit",async(e)=>{e.preventDefault();const username=document.getElementById("loginUsername").value;const password=document.getElementById("loginPassword").value;try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});if(response.ok){const user=await response.json();showMessage("Welcome back, "+user.username+"!");setTimeout(()=>showDashboard(user),1000)}else{const error=await response.text();showMessage(error||"Sign in failed",true)}}catch(error){showMessage("Connection error",true)}});document.getElementById("registerForm").addEventListener("submit",async(e)=>{e.preventDefault();const username=document.getElementById("regUsername").value;const email=document.getElementById("regEmail").value;const password=document.getElementById("regPassword").value;try{const response=await fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,email,password})});if(response.ok){const user=await response.json();showMessage("Account created for "+user.username+"!");setTimeout(()=>showDashboard(user),1000)}else{const error=await response.text();showMessage(error||"Registration failed",true)}}catch(error){showMessage("Connection error",true)}});checkAuth();
</script></body></html>\`;

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlApp);
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API endpoint not found" });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(htmlApp);
});

app.listen(port, "0.0.0.0", () => {
  console.log(\`Season Ticket Manager running on port \${port}\`);
  console.log(\`Platform: QNAP LXD Container\`);
  console.log(\`Project Path: /share/Container/projects/SeasonTicketTracker\`);
});
EOF' ticketmgr
        fi
        
        # Recreate systemd service
        lxc exec "$CONTAINER_NAME" -- bash -c 'cat > /etc/systemd/system/season-ticket-manager.service << EOF
[Unit]
Description=Season Ticket Manager Application
After=network.target
Wants=network.target

[Service]
Type=simple
User=ticketmgr
Group=ticketmgr
WorkingDirectory=/opt/season-ticket-manager
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5050
StandardOutput=journal
StandardError=journal
SyslogIdentifier=season-ticket-manager

[Install]
WantedBy=multi-user.target
EOF'
        
        # Reload and start service
        lxc exec "$CONTAINER_NAME" -- systemctl daemon-reload
        lxc exec "$CONTAINER_NAME" -- systemctl enable season-ticket-manager
        lxc exec "$CONTAINER_NAME" -- systemctl start season-ticket-manager
        
        sleep 3
        
        if lxc exec "$CONTAINER_NAME" -- systemctl is-active --quiet season-ticket-manager; then
            print_success "Service fixed and running"
        else
            print_error "Service still not starting. Trying manual start..."
            # Manual start as fallback
            lxc exec "$CONTAINER_NAME" -- su -c 'cd /opt/season-ticket-manager && nohup node server.js > server.log 2>&1 &' ticketmgr
            sleep 2
            if lxc exec "$CONTAINER_NAME" -- pgrep -f "node server.js" > /dev/null; then
                print_success "Application started manually"
            else
                print_error "Failed to start application"
            fi
        fi
    fi
}

test_command() {
    if check_container; then
        QNAP_IP=$(get_qnap_ip)
        APP_URL="http://$QNAP_IP:$APP_PORT"
        
        print_info "Testing application at $APP_URL"
        
        # Test health endpoint
        HEALTH_RESPONSE=$(curl -s "$APP_URL/api/health" 2>/dev/null || echo "FAILED")
        if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
            print_success "Health check passed"
        else
            print_error "Health check failed"
        fi
        
        # Test web interface
        WEB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" 2>/dev/null || echo "000")
        if [[ "$WEB_RESPONSE" == "200" ]]; then
            print_success "Web interface accessible"
        else
            print_error "Web interface returned status: $WEB_RESPONSE"
        fi
        
        echo ""
        print_info "Manual test: Open browser to $APP_URL"
    fi
}

# Main command handling
case "${1:-status}" in
    status)
        status_command
        ;;
    logs)
        logs_command
        ;;
    restart)
        restart_command
        ;;
    fix)
        fix_command
        ;;
    shell)
        if check_container; then
            print_info "Opening shell in container (type 'exit' to leave):"
            lxc exec "$CONTAINER_NAME" -- bash
        fi
        ;;
    stop)
        if check_container; then
            print_info "Stopping container..."
            lxc stop "$CONTAINER_NAME"
            print_success "Container stopped"
        fi
        ;;
    start)
        if check_container; then
            print_info "Starting container..."
            lxc start "$CONTAINER_NAME"
            sleep 5
            print_success "Container started"
        fi
        ;;
    test)
        test_command
        ;;
    *)
        show_usage
        ;;
esac