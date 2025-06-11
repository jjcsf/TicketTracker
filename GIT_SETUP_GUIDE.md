# Git Repository Setup for Container Station Deployment

## Step 1: Create GitHub Repository

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `season-ticket-tracker` (or your preferred name)
3. **Set to Public** (easier for Container Station access)
4. **Don't initialize** with README, .gitignore, or license (we have them)
5. **Click "Create repository"**

## Step 2: Connect Replit to GitHub

### Option A: Using Replit Git Integration
1. In Replit, open the **Version Control** tab (left sidebar)
2. Click **"Connect to GitHub"**
3. Authorize Replit to access your GitHub
4. Select your new repository
5. Click **"Connect"**
6. Commit and push all files

### Option B: Using Terminal Commands
```bash
# Set up Git configuration (if needed)
git config --global user.name "Your Name"
git config --global user.email "your.email@gmail.com"

# Add all files to Git
git add .

# Make initial commit
git commit -m "Initial commit - Season Ticket Management System"

# Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/season-ticket-tracker.git

# Push to GitHub
git push -u origin main
```

## Step 3: Clone to Container Station

### SSH into your NAS and run:
```bash
# Navigate to Container projects directory
cd /share/Container/projects/

# Clone your repository
git clone https://github.com/YOUR_USERNAME/season-ticket-tracker.git SeasonTicketTracker

# Verify all files are present
ls -la SeasonTicketTracker/
```

### Expected files in SeasonTicketTracker/:
```
✓ client/                 # React frontend
✓ server/                 # Express backend  
✓ shared/                 # TypeScript schemas
✓ package.json            # Dependencies
✓ Dockerfile              # Container build
✓ docker-compose.yml      # Container Station config
✓ README.md               # Documentation
✓ .gitignore              # Git ignore rules
```

## Step 4: Deploy in Container Station

1. **Open Container Station** web interface
2. **Applications** → **Create** → **Create Application**
3. **Select "Docker Compose"**
4. **Browse** to `/share/Container/projects/SeasonTicketTracker`
5. **Deploy** the application
6. **Wait** for build completion (5-10 minutes)
7. **Access** at `http://your-nas-ip:5050`

## Step 5: Verify Deployment Success

You should see:
- ✅ Full React application interface (not static HTML)
- ✅ Navigation menu: Teams, Seasons, Games, Seats, etc.
- ✅ Dashboard with financial analytics
- ✅ 49ers team with realistic data
- ✅ Working database with sample data

## Future Updates

To update your Container Station deployment:
```bash
# In your NAS terminal
cd /share/Container/projects/SeasonTicketTracker
git pull origin main

# In Container Station
# Stop and restart the application to pick up changes
```

## Troubleshooting

**If you still see static HTML page:**
- Verify all source files copied correctly
- Check Container Station build logs for errors
- Ensure `client/src/` directory exists with React components

**If build fails:**
- Check that package.json and package-lock.json are present
- Verify all TypeScript config files are included
- Look for missing dependencies in build logs

## Repository URL Format
Your GitHub repository URL will be:
`https://github.com/YOUR_USERNAME/season-ticket-tracker`

Replace `YOUR_USERNAME` with your actual GitHub username in all commands above.