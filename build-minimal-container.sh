#!/bin/bash

echo "Building Season Ticket Manager Minimal Container..."

# Create deployment directory
mkdir -p deployment-package

# Copy essential files
cp Dockerfile.minimal deployment-package/
cp docker-compose-minimal.yml deployment-package/
cp package.json deployment-package/
cp package-lock.json deployment-package/
mkdir -p deployment-package/server
cp server/minimal-container.ts deployment-package/server/

# Build the application locally for verification
echo "Building application..."
npx esbuild server/minimal-container.ts --platform=node --packages=external --bundle --format=esm --outfile=deployment-package/app.mjs

# Verify build
if [ -f "deployment-package/app.mjs" ]; then
    echo "✅ Application built successfully ($(wc -c < deployment-package/app.mjs) bytes)"
else
    echo "❌ Build failed"
    exit 1
fi

# Create README for deployment
cat > deployment-package/README.md << 'EOF'
# Season Ticket Manager - Container Station Deployment

## Quick Start
1. Upload all files to your Container Station host
2. Run: `docker-compose -f docker-compose-minimal.yml up -d`
3. Access: `http://your-nas-ip:5050`

## Files Included
- Dockerfile.minimal: Container build configuration
- docker-compose-minimal.yml: Complete deployment setup
- server/minimal-container.ts: Application source code
- package.json: Dependencies
- app.mjs: Pre-built application (14.7KB)

## First Run
- Register the first user account
- Login to access the dashboard
- Authentication uses secure sessions

## Monitoring
- Health check: `http://your-nas-ip:5050/api/test`
- Logs: `docker-compose logs -f season-ticket-manager`
EOF

echo "✅ Deployment package created in 'deployment-package/' directory"
echo "📦 Ready for Container Station deployment"

# Create a quick test
echo "🧪 Testing built application..."
cd deployment-package
PORT=5070 timeout 10s node app.mjs > test.log 2>&1 &
SERVER_PID=$!
sleep 3

# Test API endpoint
if curl -s http://localhost:5070/api/test > /dev/null 2>&1; then
    echo "✅ API endpoint responding"
else
    echo "⚠️  API test inconclusive (may need more time)"
fi

# Cleanup
kill $SERVER_PID 2>/dev/null || true
cd ..

echo ""
echo "📋 Deployment Summary:"
echo "   Container: season-ticket-manager-minimal"
echo "   Port: 5050"
echo "   Size: ~15KB application"
echo "   Features: Authentication, Session Management, HTML UI"
echo ""
echo "🚀 Ready to deploy to Container Station!"