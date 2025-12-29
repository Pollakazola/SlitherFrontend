# Render Deployment Guide

This guide will help you deploy the Slither-like game to Render.

## Prerequisites

- A Render account (free tier works)
- Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push your code to a Git repository** (GitHub, GitLab, or Bitbucket)

2. **Connect to Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect `render.yaml`

3. **Manual Configuration (if needed):**

   If the automatic setup doesn't work, create two services manually:

   #### Backend Service (WebSocket Server)
   - **Type:** Web Service
   - **Name:** `slither-backend`
   - **Environment:** Node
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Plan:** Free (or paid if you need more resources)

   #### Frontend Service (Static Site)
   - **Type:** Static Site
   - **Name:** `slither-frontend`
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish Directory:** `client`
   - **Environment Variable:**
     - Key: `WS_BACKEND_URL`
     - Value: `wss://slither-backend.onrender.com` (replace with your actual backend URL)

### Option 2: Manual Setup (Step by Step)

#### Step 1: Deploy Backend

1. Go to Render Dashboard → "New +" → "Web Service"
2. Connect your repository
3. Configure:
   - **Name:** `slither-backend`
   - **Root Directory:** `server`
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Click "Create Web Service"
5. Wait for deployment and note the URL (e.g., `https://slither-backend.onrender.com`)

#### Step 2: Deploy Frontend

1. Go to Render Dashboard → "New +" → "Static Site"
2. Connect your repository
3. Configure:
   - **Name:** `slither-frontend`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `client`
4. Add Environment Variable:
   - **Key:** `WS_BACKEND_URL`
   - **Value:** `wss://slither-backend.onrender.com` (use your backend URL from Step 1)
   - **Important:** Use `wss://` (secure WebSocket) not `ws://`
5. Click "Create Static Site"
6. Wait for deployment

#### Step 3: Update WebSocket URL

After both services are deployed:

1. Go to your frontend service settings
2. Update the `WS_BACKEND_URL` environment variable:
   - If your backend URL is `https://slither-backend.onrender.com`
   - Set `WS_BACKEND_URL` to `wss://slither-backend.onrender.com`
3. Trigger a new deployment (or it will auto-redeploy)

## Important Notes

- **WebSocket URLs:** Render uses HTTPS, so you must use `wss://` (secure WebSocket) not `ws://`
- **Free Tier:** Render's free tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.
- **CORS:** The server should handle WebSocket connections from your frontend domain automatically.

## Testing Locally

Before deploying, test the build process:

```bash
# Test backend
cd server
npm install
npm start

# Test frontend build
cd client
npm install
npm run build
```

## Troubleshooting

### WebSocket Connection Fails
- Check that `WS_BACKEND_URL` uses `wss://` not `ws://`
- Verify the backend service is running
- Check browser console for connection errors

### Build Fails
- Ensure `node_modules` is in `.gitignore`
- Check that all dependencies are in `package.json`
- Review build logs in Render dashboard

### 502 Bad Gateway
- Backend may be spinning up (free tier)
- Wait 30-60 seconds and refresh
- Check backend service logs

## Environment Variables Reference

### Backend
- `PORT` - Automatically set by Render (don't set manually)
- `NODE_ENV` - Set to `production` automatically

### Frontend
- `WS_BACKEND_URL` - WebSocket URL for backend (e.g., `wss://slither-backend.onrender.com`)

