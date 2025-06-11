# Git Setup Using Shell Commands

## Step 1: Create GitHub Repository First

1. Go to https://github.com/new
2. Repository name: `season-ticket-tracker`
3. Set to Public
4. Don't initialize with any files
5. Click "Create repository"
6. Copy the repository URL (will be: `https://github.com/YOUR_USERNAME/season-ticket-tracker.git`)

## Step 2: Set Up Git in Replit Shell

Open the Shell in Replit and run these commands:

```bash
# Configure Git (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your.email@gmail.com"

# Check current status
git status

# Add all files to Git
git add .

# Commit the files
git commit -m "Initial commit - Season Ticket Management System"

# Add your GitHub repository as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/season-ticket-tracker.git

# Push to GitHub
git push -u origin main
```

If the push asks for authentication, you'll need a GitHub Personal Access Token:
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with 'repo' permissions
3. Use your GitHub username and the token as password when prompted

## Step 3: Clone to Container Station

SSH into your NAS and run:

```bash
# Navigate to Container projects
cd /share/Container/projects/

# Clone your repository
git clone https://github.com/YOUR_USERNAME/season-ticket-tracker.git SeasonTicketTracker

# Verify files
ls -la SeasonTicketTracker/
```

## Step 4: Deploy in Container Station

1. Container Station → Applications → Create → Docker Compose
2. Browse to `/share/Container/projects/SeasonTicketTracker`
3. Deploy and wait for build
4. Access at `http://your-nas-ip:5050`

This will give you the complete React application instead of the static page.