# Manual File Copy Guide - Season Ticket Manager on QNAP

## Method 1: QNAP File Station (Web Interface)

### Step 1: Access File Station
1. Open QNAP web interface
2. Open **File Station**
3. Navigate to `/share/Container/projects/`
4. Create new folder: `SeasonTicketTracker`

### Step 2: Upload Files via Web Interface
1. Enter the `SeasonTicketTracker` folder
2. Click **Upload** button
3. Select and upload these files from your `lxd-qnap-package/` folder:
   - `setup-custom-path.sh`
   - `quick-setup.sh`
   - `deploy-lxd-qnap.sh`
   - `manage-container.sh`
   - `README.md`
   - `CONTAINER-STATION-LXD-SETUP.md`
   - `QUICK-SETUP-CUSTOM-PATH.md`

### Step 3: Set Permissions via SSH
```bash
ssh admin@YOUR-QNAP-IP
cd /share/Container/projects/SeasonTicketTracker/
sudo chmod +x *.sh
```

## Method 2: FTP/SFTP Client

### Using FileZilla, WinSCP, or similar:
1. Connect to your QNAP via SFTP (port 22)
2. Navigate to `/share/Container/projects/`
3. Create directory: `SeasonTicketTracker`
4. Upload all files from `lxd-qnap-package/` to this directory
5. Set permissions via SSH as shown above

## Method 3: Network Share (SMB/CIFS)

### Windows/Mac/Linux:
1. Map network drive to your QNAP
2. Navigate to `Container/projects/`
3. Create folder: `SeasonTicketTracker`
4. Copy all files from `lxd-qnap-package/` to this folder
5. Set permissions via SSH as shown above

## Method 4: USB Drive

### For local transfer:
1. Copy `lxd-qnap-package/` to USB drive
2. Insert USB into QNAP
3. Use File Station to copy from USB to `/share/Container/projects/SeasonTicketTracker/`
4. Set permissions via SSH

## After Manual Copy - Run Setup

Once files are copied and permissions set:

```bash
ssh admin@YOUR-QNAP-IP
cd /share/Container/projects/SeasonTicketTracker/
sudo ./setup-custom-path.sh
```

## Files You Need to Copy

Essential files for deployment:
- `setup-custom-path.sh` - Main deployment script
- `manage-container.sh` - Container management utilities
- `README.md` - Quick reference
- `CONTAINER-STATION-LXD-SETUP.md` - Detailed manual setup
- `QUICK-SETUP-CUSTOM-PATH.md` - Custom path instructions

Optional files:
- `quick-setup.sh` - Alternative setup script
- `deploy-lxd-qnap.sh` - Full deployment alternative

## Verify Files After Copy

```bash
ssh admin@YOUR-QNAP-IP
ls -la /share/Container/projects/SeasonTicketTracker/
```

You should see all files with proper permissions (executable scripts marked with `x`).

## Minimal Single File Deployment

If you prefer the simplest approach, you only need to copy `setup-custom-path.sh` - it contains everything needed for deployment and will create the container automatically.

The manual copy method gives you complete control over file placement and allows you to review all scripts before execution.