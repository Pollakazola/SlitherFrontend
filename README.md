# Slither-like Game

A multiplayer snake game inspired by Slither.io, built with Node.js and WebSockets.

## Features

- Real-time multiplayer gameplay
- Bot opponents
- Smooth client-side interpolation
- Sprint mechanic with food consumption
- Collision detection
- Leaderboard

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm

### Running Locally

1. **Start the backend server:**
   ```bash
   cd server
   npm install
   npm start
   ```
   The server will run on `ws://localhost:8080`

2. **Start a local HTTP server for the client:**
   ```bash
   # Option 1: Using the included Node.js server
   node client-server.js
   
   # Option 2: Using Python (if installed)
   cd client
   python -m http.server 8000
   ```

3. **Open your browser:**
   - Navigate to `http://localhost:8000`
   - Enter a name and click "Join"
   - Move your mouse to control your snake
   - Hold left mouse button or Space to sprint

## Deployment

See [DEPLOY.md](./DEPLOY.md) for detailed Render deployment instructions.

### Quick Deploy to Render

1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to Render
3. Deploy backend as a Web Service
4. Deploy frontend as a Static Site
5. Set `WS_BACKEND_URL` environment variable in frontend service

## Project Structure

```
.
├── server/           # Backend WebSocket server
│   ├── game/         # Game logic (snakes, food, collisions, bots)
│   └── server.js     # Main server entry point
├── client/           # Frontend static files
│   ├── index.html    # Main HTML file
│   ├── main.js       # Client entry point
│   ├── net.js        # WebSocket communication
│   ├── render.js     # Rendering and graphics
│   └── ui.js         # UI controls
└── DEPLOY.md         # Deployment guide
```

## Controls

- **Mouse Movement:** Control snake direction
- **Left Click / Space:** Sprint (consumes food, makes you faster)
- **Join Button:** Join the game with your name
- **Respawn Button:** Respawn after death
- **Feed Button:** Add food (for testing)

## Technical Details

- **Backend:** Node.js with WebSocket (ws library)
- **Frontend:** Vanilla JavaScript (ES6 modules)
- **Protocol:** JSON over WebSocket
- **Tick Rate:** 20 Hz server updates
- **Interpolation:** Client-side smooth rendering

## License

This is a clean-room implementation for educational purposes.

