#!/bin/bash

# Webhook script for automatic updates
# Place this in your NAS web server directory

cd /share/Container/projects/SeasonTicketTracker
git pull origin main
docker-compose up -d --build
