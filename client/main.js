// Main client logic
import * as net from './net.js';
import * as ui from './ui.js';
import * as render from './render.js';

let mouse = { x: innerWidth / 2, y: innerHeight / 2 };
let lastInputTime = 0;
let sprinting = false;
const INPUT_RATE_LIMIT = 50; // 20 Hz = 50ms

addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

addEventListener("mousedown", (e) => {
  if (e.button === 0) { // Left mouse button
    sprinting = true;
  }
});

addEventListener("mouseup", (e) => {
  if (e.button === 0) { // Left mouse button
    sprinting = false;
  }
});

addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    sprinting = true;
  }
});

addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    sprinting = false;
  }
});

function sendInput(angle) {
  const now = performance.now();
  if (now - lastInputTime < INPUT_RATE_LIMIT) return;
  lastInputTime = now;
  net.send({ t: "input", a: angle, sprint: sprinting });
}

let pendingName = null;
let pendingSkinId = null;
let deathTimeout = null;

function handleJoin(name, skinId = "default") {
  const nameToSend = String(name || "Guest").trim();
  net.send({ t: "join", name: nameToSend, skinId: skinId });
}

function handleRespawn() {
  net.send({ t: "respawn" });
}

function handleFeed() {
  net.send({ t: "feed" });
}

let fullscreenActive = false;

function handleStartGame(name, skinId = "default") {
  // Store the name and skinId to send after connection
  pendingName = name;
  pendingSkinId = skinId;
  // Hide landing page
  ui.showLandingPage(false);
  // Show fullscreen button
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.classList.add('visible');
  }
  // Connect to server
  net.connect();
}

// Fullscreen button handler
function setupFullscreen() {
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (!fullscreenBtn) return;
  
  fullscreenBtn.addEventListener('click', () => {
    if (!fullscreenActive) {
      // Enter fullscreen mode with 80% zoom
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          render.setZoom(0.8);
          fullscreenActive = true;
          fullscreenBtn.textContent = '⛶ Exit Fullscreen';
        }).catch(err => {
          console.log('Fullscreen error:', err);
          // Still set zoom even if fullscreen fails
          render.setZoom(0.8);
          fullscreenActive = true;
          fullscreenBtn.textContent = '⛶ Exit Fullscreen';
        });
      } else {
        // Fallback: just set zoom if fullscreen API not available
        render.setZoom(0.8);
        fullscreenActive = true;
        fullscreenBtn.textContent = '⛶ Exit Fullscreen';
      }
    } else {
      // Exit fullscreen mode and reset zoom
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          render.setZoom(1.0);
          fullscreenActive = false;
          fullscreenBtn.textContent = '⛶ Fullscreen (80% Zoom)';
        }).catch(err => {
          console.log('Exit fullscreen error:', err);
        });
      } else {
        render.setZoom(1.0);
        fullscreenActive = false;
        fullscreenBtn.textContent = '⛶ Fullscreen (80% Zoom)';
      }
    }
  });
  
  // Listen for fullscreen changes (user pressing ESC, etc.)
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && fullscreenActive) {
      render.setZoom(1.0);
      fullscreenActive = false;
      fullscreenBtn.textContent = '⛶ Fullscreen (80% Zoom)';
    }
  });
}

ui.setHandlers(handleJoin, handleRespawn, handleFeed, handleStartGame);

// Show landing page initially
ui.showLandingPage(true);

net.setMessageHandler((event) => {
  if (event.type === 'connected') {
    // Connection established
  } else if (event.type === 'disconnected') {
    // Disconnected
  } else if (event.type === 'error') {
    // WebSocket error
  } else if (event.type === 'message') {
    const msg = event.data;

    if (msg.t === "welcome") {
      render.updateState({ meId: msg.id, world: msg.world });
      // Send join message with pending name and skinId
      // Always send join message, even if no pending name (use "Guest" as fallback)
      // Add a small delay to ensure connection is fully established
      setTimeout(() => {
        const nameToSend = (pendingName && pendingName.trim()) || "Guest";
        const skinIdToSend = pendingSkinId || "default";
        handleJoin(nameToSend, skinIdToSend);
        pendingName = null;
        pendingSkinId = null;
      }, 50);
    }

    if (msg.t === "state") {
      const s = msg.s;
      render.updateState({ world: s.world });
      
      // Convert snake array to Map for interpolation
      const snakesMap = new Map();
      for (const sn of s.snakes) {
        snakesMap.set(sn.id, sn);
      }
      
      render.updateSnapshot({
        snakes: snakesMap,
        food: s.food,
      });

      // Check if player is dead
      const interpState = render.getInterpolatedState();
      const me = render.getMe(interpState);
      if (me === undefined) {
        // Redirect to landing page after a short delay (only if not already set)
        if (!deathTimeout) {
          deathTimeout = setTimeout(() => {
            ui.showLandingPage(true);
            net.disconnect();
            deathTimeout = null;
          }, 2000); // Wait 2 seconds before redirecting
        }
      } else {
        // Clear death timeout if player respawned
        if (deathTimeout) {
          clearTimeout(deathTimeout);
          deathTimeout = null;
        }
      }
    }
  }
});

function gameLoop() {
  requestAnimationFrame(gameLoop);

  // Calculate aim angle and send input
  const interpState = render.getInterpolatedState();
  const me = render.getMe(interpState);
  if (me && me.segs && me.segs.length) {
    const [hx, hy] = me.segs[0];
    const [hsx, hsy] = render.worldToScreen(hx, hy, interpState.cam);
    const dx = mouse.x - hsx;
    const dy = mouse.y - hsy;
    const ang = Math.atan2(dy, dx);
    sendInput(ang);
  }

  render.render();
}

// Setup fullscreen functionality
setupFullscreen();

// Don't auto-connect - wait for user to start game
// net.connect();
gameLoop();
