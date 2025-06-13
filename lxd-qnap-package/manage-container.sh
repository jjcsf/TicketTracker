#!/bin/bash

CONTAINER_NAME="season-ticket-manager"

show_usage() {
    echo "Season Ticket Manager - Container Management"
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  status    - Show container status and resource usage"
    echo "  start     - Start the container"
    echo "  stop      - Stop the container"
    echo "  restart   - Restart the container"
    echo "  logs      - Show application logs"
    echo "  shell     - Access container shell"
    echo "  health    - Check application health"
    echo "  resources - Adjust container resources"
    echo "  backup    - Backup container data"
    echo "  restore   - Restore container data"
}

check_container_exists() {
    if ! lxc list | grep -q "$CONTAINER_NAME"; then
        echo "Container '$CONTAINER_NAME' not found. Please deploy first."
        exit 1
    fi
}

case "$1" in
    "status")
        echo "Container Status:"
        lxc list "$CONTAINER_NAME"
        echo ""
        echo "Resource Usage:"
        lxc info "$CONTAINER_NAME"
        echo ""
        echo "Service Status:"
        lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager
        ;;
    
    "start")
        check_container_exists
        echo "Starting container..."
        lxc start "$CONTAINER_NAME"
        sleep 3
        echo "Container started. Checking service..."
        lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager
        ;;
    
    "stop")
        check_container_exists
        echo "Stopping container..."
        lxc stop "$CONTAINER_NAME"
        echo "Container stopped."
        ;;
    
    "restart")
        check_container_exists
        echo "Restarting container..."
        lxc restart "$CONTAINER_NAME"
        sleep 5
        echo "Container restarted. Checking service..."
        lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager
        ;;
    
    "logs")
        check_container_exists
        echo "Application logs (press Ctrl+C to exit):"
        lxc exec "$CONTAINER_NAME" -- journalctl -u season-ticket-manager -f
        ;;
    
    "shell")
        check_container_exists
        echo "Accessing container shell..."
        lxc exec "$CONTAINER_NAME" -- bash
        ;;
    
    "health")
        check_container_exists
        QNAP_IP=$(hostname -I | awk '{print $1}')
        echo "Checking application health..."
        if curl -s "http://localhost:5050/api/health" > /dev/null 2>&1; then
            echo "✅ Application is healthy"
            curl -s "http://localhost:5050/api/health" | python3 -m json.tool 2>/dev/null || echo "Response received"
        else
            echo "❌ Application not responding"
            echo "Check logs with: $0 logs"
        fi
        ;;
    
    "resources")
        check_container_exists
        echo "Current resource limits:"
        lxc config get "$CONTAINER_NAME" limits.memory
        lxc config get "$CONTAINER_NAME" limits.cpu
        echo ""
        read -p "Enter new memory limit (e.g., 2GB): " memory
        read -p "Enter new CPU limit (e.g., 4): " cpu
        
        if [ ! -z "$memory" ]; then
            lxc config set "$CONTAINER_NAME" limits.memory "$memory"
            echo "Memory limit set to $memory"
        fi
        
        if [ ! -z "$cpu" ]; then
            lxc config set "$CONTAINER_NAME" limits.cpu "$cpu"
            echo "CPU limit set to $cpu"
        fi
        
        echo "Restart container to apply changes: $0 restart"
        ;;
    
    "backup")
        check_container_exists
        BACKUP_DIR="/share/backups/season-ticket-manager"
        mkdir -p "$BACKUP_DIR"
        BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        
        echo "Creating backup..."
        lxc stop "$CONTAINER_NAME"
        lxc export "$CONTAINER_NAME" "$BACKUP_FILE"
        lxc start "$CONTAINER_NAME"
        
        echo "Backup created: $BACKUP_FILE"
        ls -lh "$BACKUP_FILE"
        ;;
    
    "restore")
        BACKUP_DIR="/share/backups/season-ticket-manager"
        if [ ! -d "$BACKUP_DIR" ]; then
            echo "No backup directory found at $BACKUP_DIR"
            exit 1
        fi
        
        echo "Available backups:"
        ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "No backup files found"
        echo ""
        read -p "Enter backup file path: " backup_file
        
        if [ ! -f "$backup_file" ]; then
            echo "Backup file not found: $backup_file"
            exit 1
        fi
        
        echo "Stopping and removing existing container..."
        lxc stop "$CONTAINER_NAME" --force 2>/dev/null || true
        lxc delete "$CONTAINER_NAME" --force 2>/dev/null || true
        
        echo "Restoring from backup..."
        lxc import "$backup_file" --alias "$CONTAINER_NAME"
        lxc start "$CONTAINER_NAME"
        
        echo "Restore completed. Checking status..."
        sleep 5
        lxc exec "$CONTAINER_NAME" -- systemctl status season-ticket-manager --no-pager
        ;;
    
    *)
        show_usage
        ;;
esac