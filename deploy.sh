#!/bin/bash
# Deployment script for MRST production

set -e  # Exit on error

BRANCH="${1:-claude/code-review-feedback-YAe51}"
SERVER="ec2-user@app.travelautorental.com"
PROJECT_DIR="/home/ec2-user/projects/mrst"

echo "🚀 Deploying MRST to production..."
echo "📦 Branch: $BRANCH"
echo ""

# Deploy to production server
ssh $SERVER << EOF
  set -e
  cd $PROJECT_DIR

  echo "📥 Pulling latest code..."
  git fetch origin
  git checkout $BRANCH
  git pull origin $BRANCH

  echo "🔄 Restarting services..."
  pm2 restart mrst-api
  pm2 restart mrst-web

  echo "📊 Service status:"
  pm2 list | grep mrst

  echo ""
  echo "✅ Deployment complete!"
  echo ""
  echo "🔗 URLs:"
  echo "   - App: https://app.travelautorental.com/mrst/customers"
  echo "   - API: https://app.travelautorental.com/api/trpc/customers.stats"
EOF

echo ""
echo "✨ Done! Wait 10-15 seconds for services to fully restart."
