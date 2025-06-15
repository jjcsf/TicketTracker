# Deploy Updated Season Ticket Manager to QNAP

## Quick Deployment Options

### Option 1: LXD Container (Recommended)

1. **Run the deployment script on your QNAP:**
   ```bash
   sudo ./deploy-qnap-updated.sh
   ```

2. **Access your application:**
   - URL: `http://your-qnap-ip:5050`
   - The application will be ready with basic authentication

### Option 2: Docker Container

1. **Build and deploy using Docker:**
   ```bash
   ./deploy-updated-qnap.sh
   ```

2. **Upload to Container Station:**
   - Copy `docker-compose-qnap.yml` to your QNAP
   - Import it in Container Station
   - Start the container

## What's Changed

✅ **Fixed Authentication**: Switched from Replit auth to basic authentication  
✅ **Working API**: All endpoints now respond correctly  
✅ **Database Ready**: PostgreSQL integration working  
✅ **Full Functionality**: Dashboard, games, finances, reports all functional  

## Database Configuration

After deployment, configure your PostgreSQL connection:

1. **Edit environment file:**
   ```bash
   lxc exec season-ticket-manager-updated -- nano /opt/season-ticket-manager/.env
   ```

2. **Update DATABASE_URL:**
   ```
   DATABASE_URL=postgresql://username:password@host:port/database
   ```

3. **Restart the service:**
   ```bash
   lxc exec season-ticket-manager-updated -- systemctl restart season-ticket-manager
   ```

## Management Commands

- **View logs:** `lxc exec season-ticket-manager-updated -- journalctl -u season-ticket-manager -f`
- **Check status:** `lxc exec season-ticket-manager-updated -- systemctl status season-ticket-manager`
- **Restart:** `lxc exec season-ticket-manager-updated -- systemctl restart season-ticket-manager`

## Features Available

- Complete season ticket management dashboard
- Game scheduling and management
- Financial tracking and reporting
- Ticket holder management
- Seat ownership and transfers
- Real-time analytics

The application is now fully functional with proper authentication and all API endpoints working correctly.