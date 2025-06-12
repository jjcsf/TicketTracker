# Running Update Script on Your NAS

## Method 1: SSH Terminal (Recommended)

1. **Enable SSH** on your NAS (if not already enabled):
   - QNAP: Control Panel → Network & File Services → Telnet/SSH
   - Synology: Control Panel → Terminal & SNMP → Enable SSH

2. **Connect via SSH**:
   ```bash
   ssh admin@your-nas-ip
   # Enter your NAS admin password
   ```

3. **Run the update script**:
   ```bash
   cd /share/Container/projects/
   rm -rf SeasonTicketTracker
   git clone https://github.com/jjcsf/TicketTracker.git SeasonTicketTracker
   cd SeasonTicketTracker
   docker-compose down
   docker-compose up -d --build
   ```

## Method 2: Container Station Terminal

1. **Open Container Station** web interface
2. **Click "Terminal"** or "Console" button
3. **Run the commands** directly in the web terminal

## Method 3: File Manager + Script

1. **Upload script file**:
   - Download `container-git-update.sh` from Replit
   - Upload to NAS via file manager
   - Place in `/share/Container/projects/`

2. **Make executable and run**:
   ```bash
   chmod +x /share/Container/projects/container-git-update.sh
   ./container-git-update.sh
   ```

## Method 4: Web Terminal (if available)

Some NAS systems have web-based terminals:
- QNAP: Control Panel → Applications → Terminal
- Access and run the commands directly

## Expected Result

After running the script:
- Container rebuilds with complete React application
- Access full dashboard at `http://your-nas-ip:5050`
- No more static landing page