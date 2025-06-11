# Git-Based Container Deployment Guide

## Overview
Yes, you can absolutely update your Container Station app using Git! I've created several approaches for Git-based deployment and updates.

## Method 1: Manual Git Updates (Simplest)

### Setup
1. Use `Dockerfile.git-enabled` instead of the regular Dockerfile
2. This includes Git, curl, and bash in the container
3. Access your container via Container Station's terminal

### Updating the App
```bash
# Access container terminal in Container Station
docker exec -it ticket-management_app_1 /bin/bash

# Run the update script
./update.sh
```

The update script will:
- Create automatic backups
- Pull latest changes from your Git repository
- Rebuild the frontend
- Restart the application

## Method 2: Webhook-Based Auto-Updates (Advanced)

### Setup
1. Use `docker-compose.git-enabled.yml`
2. Configure `webhook-config.json` with your GitHub webhook secret
3. Set up GitHub webhook to point to `http://your-nas-ip:9000/hooks/update-app`

### How It Works
- Push code to your GitHub repository
- GitHub automatically triggers webhook
- Container Station receives webhook and updates app
- Zero manual intervention required

## Method 3: SSH Git Access (For Private Repos)

### Setup
1. Generate SSH keys on your NAS
2. Add public key to your GitHub account
3. Mount SSH keys in docker-compose:
```yaml
volumes:
  - ./ssh_keys:/root/.ssh:ro
```

### Commands for Container Access
```bash
# Access running container
docker exec -it ticket-management_app_1 /bin/bash

# Pull updates manually
git pull origin main
npm run build
pm2 restart all  # or restart container
```

## Method 4: Container Station Integration

### Using Container Station's Built-in Features
1. **Registry Integration**: Push to Docker registry, update container image
2. **Volume Mounting**: Mount your code directory directly
3. **CI/CD Pipeline**: Connect with Jenkins or GitLab CI

### Example Volume Mount Approach
```yaml
services:
  app:
    image: node:20-alpine
    volumes:
      - /Container/projects/ticket-management:/app
    working_dir: /app
    command: ["npm", "run", "dev"]
```

## Recommended Approach

For your use case, I recommend **Method 1 (Manual Git Updates)** because:
- Simple to set up and understand
- Full control over update timing
- Automatic backups before updates
- Works with both public and private repositories

### Setup Steps:
1. Replace `Dockerfile.container` with `Dockerfile.git-enabled`
2. Update your repository URL in `git-update-script.sh`
3. Rebuild your Container Station application
4. Use the container terminal to run `./update.sh` when you want to update

### Repository Setup:
1. Create a GitHub repository for your ticket management app
2. Push all your current code to the repository
3. Configure the Git URL in the update script
4. Test the update process

This gives you a production-ready deployment that can be easily updated from your Git repository while maintaining full control and safety through automatic backups.