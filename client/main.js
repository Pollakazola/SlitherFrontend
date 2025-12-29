// Main client logic
import * as net from './net.js';
import * as ui from './ui.js';
import * as render from './render.js';

let mouse = { x: innerWidth / 2, y: innerHeight / 2 };
let lastInputTime = 0;
let sprinting = false;
let deathTimeout = null;
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

function handleJoin(name) {
  net.send({ t: "join", name });
}

function handleRespawn() {
  net.send({ t: "respawn" });
}

function handleFeed() {
  net.send({ t: "feed" });
}

function handleStartGame(name) {
  // Update the name input in the game UI
  document.getElementById("name").value = name;
  // Hide landing page
  ui.showLandingPage(false);
  // Connect to server
  net.connect();
  // Join with the name
  setTimeout(() => {
    handleJoin(name);
  }, 100); // Small delay to ensure connection is established
}

ui.setHandlers(handleJoin, handleRespawn, handleFeed, handleStartGame);

// Show landing page initially
ui.showLandingPage(true);

net.setMessageHandler((event) => {
  if (event.type === 'connected') {
    ui.setStatus(`Connected to ${net.WS_URL}`);
  } else if (event.type === 'disconnected') {
    ui.setStatus("Disconnected. Refresh to retry.");
  } else if (event.type === 'error') {
    ui.setStatus("WebSocket error.");
  } else if (event.type === 'message') {
    const msg = event.data;

    if (msg.t === "welcome") {
      render.updateState({ meId: msg.id, world: msg.world });
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
        ui.showDeathMessage(true);
        // Redirect to landing page after a short delay (only if not already set)
        if (!deathTimeout) {
          deathTimeout = setTimeout(() => {
            ui.showLandingPage(true);
            ui.showDeathMessage(false);
            net.disconnect();
            deathTimeout = null;
          }, 2000); // Show death message for 2 seconds before redirecting
        }
      } else {
        ui.showDeathMessage(false);
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

// Don't auto-connect - wait for user to start game
// net.connect();
gameLoop();
