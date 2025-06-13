# Quick Setup with Custom Path - Season Ticket Manager on QNAP LXD

## Using Your Preferred Directory: /share/Container/projects/SeasonTicketTracker

## Step 1: Create Project Directory and Transfer Files
```bash
# From your computer, create the directory and upload files
scp -r lxd-qnap-package/ admin@YOUR-QNAP-IP:/tmp/

# SSH into QNAP to organize files
ssh admin@YOUR-QNAP-IP

# Create your project directory structure
sudo mkdir -p /share/Container/projects/SeasonTicketTracker

# Move files to your preferred location
sudo mv /tmp/lxd-qnap-package/* /share/Container/projects/SeasonTicketTracker/

# Set proper permissions
sudo chmod +x /share/Container/projects/SeasonTicketTracker/*.sh
```

## Step 2: Run Quick Setup from Custom Path
```bash
# Navigate to your project directory
cd /share/Container/projects/SeasonTicketTracker/

# Run the quick setup script
sudo ./quick-setup.sh
```

## Benefits of This Directory Structure
- **Organization**: Keeps all container projects organized under `/share/Container/projects/`
- **Persistence**: Files stored in `/share/Container/` survive system updates
- **Accessibility**: Easy to find and manage through QNAP File Station
- **Backup**: Can be included in scheduled backups for the Container share

## Alternative One-Command Setup
```bash
# Complete setup in one command block
ssh admin@YOUR-QNAP-IP << 'EOF'
sudo mkdir -p /share/Container/projects/SeasonTicketTracker
cd /share/Container/projects/SeasonTicketTracker
# Upload your files here first, then run:
sudo ./quick-setup.sh
EOF
```

## File Organization After Setup
```
/share/Container/projects/SeasonTicketTracker/
├── quick-setup.sh                    # Main deployment script
├── deploy-lxd-qnap.sh               # Alternative full deployment
├── manage-container.sh              # Container management utilities
├── CONTAINER-STATION-LXD-SETUP.md   # Detailed manual setup guide
├── README.md                        # Quick start guide
└── lxd-deployment-qnap.md          # Complete deployment documentation
```

## Container Management from Custom Path
```bash
# All management commands work from your project directory
cd /share/Container/projects/SeasonTicketTracker/

# Use the management script
./manage-container.sh status
./manage-container.sh logs
./manage-container.sh backup
```

## Access Information
- **Application URL**: `http://YOUR-QNAP-IP:5050`
- **Health Check**: `http://YOUR-QNAP-IP:5050/api/health`
- **Project Files**: `/share/Container/projects/SeasonTicketTracker/`
- **Container Name**: `season-ticket-manager`

This setup maintains all functionality while using your preferred directory structure for better project organization.