# Quick Render Deployment Guide

## Step-by-Step (5 minutes)

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push
```

### 2. Deploy Backend (WebSocket Server)

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name:** `slither-backend`
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Click **"Create Web Service"**
6. Wait for deployment (2-3 minutes)
7. **Copy the service URL** (e.g., `https://slither-backend-xxxx.onrender.com`)

### 3. Deploy Frontend (Static Site)

1. In Render dashboard, click **"New +"** → **"Static Site"**
2. Connect the same GitHub repository
3. Configure:
   - **Name:** `slither-frontend`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `client`
4. **Add Environment Variable:**
   - Click **"Environment"** tab
   - Click **"Add Environment Variable"**
   - **Key:** `WS_BACKEND_URL`
   - **Value:** `wss://slither-backend-xxxx.onrender.com`
     - Replace `slither-backend-xxxx` with your actual backend name
     - **Important:** Use `wss://` (not `ws://` or `https://`)
5. Click **"Create Static Site"**
6. Wait for deployment

### 4. Play!

Open your frontend URL (e.g., `https://slither-frontend-xxxx.onrender.com`) and start playing!

## Troubleshooting

**WebSocket won't connect?**
- Make sure `WS_BACKEND_URL` uses `wss://` (secure WebSocket)
- Check that backend service is running (not sleeping)
- Wait 30-60 seconds if it's the first request (free tier spins down)

**Build fails?**
- Check build logs in Render dashboard
- Ensure `node_modules` is in `.gitignore`
- Verify all files are committed to git

**502 Error?**
- Backend is spinning up (free tier)
- Wait 30-60 seconds and refresh

## Notes

- Free tier services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds to wake up
- For production, consider upgrading to a paid plan

