// Main server entry point
const WebSocket = require("ws");
const { PORT, TICK_HZ, FOOD } = require('./game/constants');
const { makeSnake, updateSnake, checkCollisions, killSnake } = require('./game/snake');
const { initFood, checkFoodCollisions } = require('./game/food');
const { snapshotForClient, broadcast, validateInput } = require('./game/net');
const { WORLD } = require('./game/constants');

const wss = new WebSocket.Server({ port: PORT });
console.log(`Server listening on ws://localhost:${PORT}`);

const state = {
  snakes: new Map(), // socket -> snake
  food: initFood(FOOD.count),
};

// Function to respawn all bots
function respawnAllBots() {
  let respawnedCount = 0;
  for (const [key, sn] of state.snakes) {
    if (sn.isBot === true) {
      // Create a fresh snake with the same ID and name
      const fresh = makeSnake(sn.name);
      fresh.id = sn.id; // Keep id stable
      fresh.isBot = true;
      fresh.lastInputTime = 0;
      state.snakes.set(key, fresh);
      respawnedCount++;
    }
  }
  console.log(`Respawned ${respawnedCount} bots`);
  return respawnedCount;
}

function stepServer() {
  // Move all snakes
  for (const [, sn] of state.snakes) {
    updateSnake(sn, state.food);
  }

  // Check food collisions
  checkFoodCollisions([...state.snakes.values()], state.food);

  // Check snake collisions
  const aliveSnakes = [...state.snakes.values()].filter(s => s.alive);
  for (const sn of aliveSnakes) {
    if (checkCollisions(sn, aliveSnakes, state.food)) {
      killSnake(sn, state.food);
    }
  }

  // Broadcast snapshot
  broadcast(wss, { t: "state", s: snapshotForClient(state.snakes, state.food) });
}

wss.on("connection", (ws) => {
  const sn = makeSnake("Guest");
  state.snakes.set(ws, sn);

  ws.send(JSON.stringify({ t: "welcome", id: sn.id, world: WORLD }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const now = Date.now();

    if (msg.t === "join") {
      if (validateInput(msg, sn, now)) {
        sn.name = String(msg.name || "Guest").slice(0, 18);
      }
    }

    if (msg.t === "input") {
      if (validateInput(msg, sn, now)) {
        const a = Number(msg.a);
        sn.targetAngle = a;
      }
    }

    if (msg.t === "respawn") {
      if (validateInput(msg, sn, now)) {
        const fresh = makeSnake(sn.name);
        fresh.id = sn.id; // Keep id stable
        state.snakes.set(ws, fresh);
      }
    }
  });

  ws.on("close", () => {
    state.snakes.delete(ws);
  });
});

setInterval(stepServer, 1000 / TICK_HZ);

// Make respawnAllBots available globally for console access
global.respawnAllBots = respawnAllBots;

// Call respawnAllBots immediately to respawn any existing bots
respawnAllBots();
