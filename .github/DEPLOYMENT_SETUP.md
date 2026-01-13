# GitHub Actions Deployment Setup

## Overview
Automatic deployment is configured via GitHub Actions. Pushing to specific branches will trigger deployment to production.

## Branches that auto-deploy:
- `main`
- `frontend-work`
- `claude/code-review-feedback-YAe51`
- `claude/find-uncommitted-changes-6sZ5T`

## One-time Setup Required

You need to add your SSH private key to GitHub Secrets so the workflow can connect to the production server.

### Steps:

1. **Get your SSH private key** from the production server:
   ```bash
   # On your local machine, copy the private key
   # This is the key that can connect to ec2-user@app.travelautorental.com
   cat ~/.ssh/id_rsa
   # Or if you use a specific key:
   cat ~/.ssh/your_key_name
   ```

2. **Add the key to GitHub Secrets**:
   - Go to: https://github.com/Mordyroth/mrst/settings/secrets/actions
   - Click "New repository secret"
   - Name: `SSH_PRIVATE_KEY`
   - Value: Paste the entire private key (including `-----BEGIN ... KEY-----` lines)
   - Click "Add secret"

3. **Test the deployment**:
   ```bash
   # Make a small change and push
   git push origin main
   ```

4. **Monitor the deployment**:
   - Go to: https://github.com/Mordyroth/mrst/actions
   - You'll see the deployment running in real-time

## How It Works

When you push to any of the configured branches:
1. ✅ GitHub Actions checks out the code
2. 📡 Connects to production server via SSH
3. 📥 Pulls latest code on the server
4. 📦 Installs dependencies with `pnpm install`
5. 🏗️ Builds the project with `pnpm build`
6. 🔄 Restarts PM2 services (mrst-api, mrst-web)
7. ✅ Shows deployment status

## Manual Deployment (Fallback)

If you need to deploy manually:
```bash
./deploy.sh
```

Or SSH directly:
```bash
ssh ec2-user@app.travelautorental.com 'cd /home/ec2-user/projects/mrst && git pull && pnpm install && pnpm build && pm2 restart all'
```

## Troubleshooting

### "Host key verification failed"
Add the server to GitHub's known hosts by running this once from a machine that can access the server:
```bash
ssh-keyscan app.travelautorental.com >> ~/.ssh/known_hosts
```

### "Permission denied (publickey)"
- Check that SSH_PRIVATE_KEY secret is set correctly
- Verify the key has access to ec2-user@app.travelautorental.com

### Deployment is slow
The workflow installs all dependencies and builds from scratch. Future optimization: add caching.

## Adding More Branches

Edit `.github/workflows/deploy.yml` and add branches to the `branches:` list:
```yaml
on:
  push:
    branches:
      - main
      - your-new-branch
```
