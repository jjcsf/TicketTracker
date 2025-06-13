# Quick Setup Instructions - Season Ticket Manager on QNAP LXD

## Prerequisites
- QNAP NAS with Container Station
- SSH access to your QNAP
- Administrative privileges

## Step 1: Transfer Files to QNAP
```bash
# From your computer, upload the deployment package
scp -r lxd-qnap-package/ admin@YOUR-QNAP-IP:/share/homes/admin/
```

## Step 2: Connect to QNAP and Run Setup
```bash
# SSH into your QNAP
ssh admin@YOUR-QNAP-IP

# Navigate to the deployment directory
cd /share/homes/admin/lxd-qnap-package/

# Run the quick setup script
sudo ./quick-setup.sh
```

## What the Quick Setup Does
1. ✅ Installs and initializes LXD if needed
2. ✅ Creates Ubuntu 22.04 container
3. ✅ Installs Node.js 20 and dependencies
4. ✅ Deploys Season Ticket Manager application
5. ✅ Configures systemd service for auto-start
6. ✅ Sets up port forwarding on port 5050
7. ✅ Applies resource limits (1GB RAM, 2 CPU cores)

## Expected Output
```
Season Ticket Manager - Quick LXD Setup for QNAP
================================================
[STEP] Checking LXD installation...
[SUCCESS] LXD is available
[STEP] Creating Ubuntu 22.04 container...
[STEP] Waiting for container to initialize...
[STEP] Configuring container resources...
[STEP] Setting up port forwarding...
[STEP] Installing Node.js and dependencies...
[STEP] Setting up application structure...
[STEP] Installing application dependencies...
[STEP] Deploying application code...
[STEP] Creating systemd service...
[STEP] Starting application service...
[SUCCESS] Service is running
[SUCCESS] Deployment Complete!

Container: season-ticket-manager
Application URL: http://YOUR-QNAP-IP:5050
Health Check: http://YOUR-QNAP-IP:5050/api/health
```

## Access Your Application
After successful deployment:
1. Open web browser
2. Navigate to `http://YOUR-QNAP-IP:5050`
3. Register your first user account
4. Log in to access the dashboard

## Container Management
```bash
# View container status
lxc list

# Check application logs
lxc exec season-ticket-manager -- journalctl -u season-ticket-manager -f

# Stop/start container
lxc stop season-ticket-manager
lxc start season-ticket-manager

# Access container shell
lxc exec season-ticket-manager -- bash
```

## Troubleshooting
If the setup fails:
1. Check available resources: `free -h`
2. Verify LXD status: `lxc version`
3. Review error messages in the output
4. Use the detailed setup guide: `CONTAINER-STATION-LXD-SETUP.md`

The quick setup typically completes in 5-10 minutes depending on your QNAP's performance and internet connection speed.