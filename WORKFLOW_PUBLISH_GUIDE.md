# Publish GitHub Actions Workflow

## Current Status
The workflow file exists locally at `.github/workflows/docker-publish.yml` but needs to be pushed to GitHub.

## Steps to Publish Workflow

1. **Use Version Control Tab**: Click Git icon in Replit sidebar
2. **Add commit message**: "Add GitHub Actions Docker build workflow"
3. **Click "Commit & Push"**

## After Publishing
- Workflow will appear at: https://github.com/jjcsf/TicketTracker/actions
- Any future pushes to main branch will trigger Docker build
- Image will be published as: jjcsf/season-ticket-manager:latest

## Manual Trigger Option
After workflow is published, you can manually trigger it:
1. Go to GitHub Actions tab
2. Select "Build and Push Docker Image" workflow
3. Click "Run workflow" button
4. Choose "main" branch and run

The workflow will build your complete season ticket application with React dashboard and publish to Docker Hub.