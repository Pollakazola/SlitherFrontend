// Main server entry point
const WebSocket = require("ws");
const { PORT, TICK_HZ, FOOD, BOT } = require('./game/constants');
const { makeSnake, updateSnake, checkCollisions, killSnake } = require('./game/snake');
const { initFood, checkFoodCollisions } = require('./game/food');
const { snapshotForClient, broadcast, validateInput } = require('./game/net');
const { WORLD } = require('./game/constants');
const { updateBotAI, isBot } = require('./game/bot');
const { rand } = require('./game/world');

const wss = new WebSocket.Server({ port: PORT });
console.log(`Server listening on ws://localhost:${PORT}`);

const state = {
  snakes: new Map(), // socket -> snake (for players) or "bot_" + id -> snake (for bots)
  food: initFood(FOOD.count),
};

// Helper function to create a bot snake
function createBot() {
  const botNames = ["Bot1", "Bot2", "Bot3", "Bot4", "Bot5", "Bot6", "Bot7", "Bot8", "Bot9", "Bot10",
                    "AI_Snake", "AutoBot", "SnakeBot", "Bot_AI", "Computer", "AutoSnake", "AI_Bot"];
  const nameIndex = Math.floor(rand(0, botNames.length));
  const name = botNames[nameIndex];
  const sn = makeSnake(name);
  sn.isBot = true;
  sn.lastInputTime = 0; // Bots never send input
  const botKey = "bot_" + sn.id;
  state.snakes.set(botKey, sn);
  return sn;
}

// Spawn initial bots
for (let i = 0; i < BOT.count; i++) {
  createBot();
}
console.log(`Spawned ${BOT.count} bots`);

function stepServer() {
  // Update bot AI for all bot snakes and respawn dead bots
  const aliveBots = [];
  const allSnakesArray = [...state.snakes.values()];
  
  for (const [key, sn] of state.snakes) {
    if (typeof key === 'string' && key.startsWith('bot_')) {
      if (!sn.alive) {
        // Bot died, respawn it (preserve bot ID and key)
        const fresh = makeSnake(sn.name);
        fresh.id = sn.id; // Keep bot ID stable
        fresh.isBot = true;
        fresh.lastInputTime = 0;
        state.snakes.set(key, fresh);
        continue;
      }
      
      // Update bot AI before movement
      updateBotAI(sn, state.food, allSnakesArray);
      aliveBots.push(sn);
    }
  }
  
  // Maintain minimum bot count (safety limit to prevent infinite loop)
  let spawnAttempts = 0;
  const maxSpawnAttempts = 20; // Safety limit
  while (aliveBots.length < BOT.minCount && spawnAttempts < maxSpawnAttempts) {
    const newBot = createBot();
    aliveBots.push(newBot);
    spawnAttempts++;
  }

  // Move all snakes (both players and bots use same updateSnake function)
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
  sn.isBot = false; // Mark as player
  sn.lastInputTime = Date.now(); // Initialize input time
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
        if (msg.sprint !== undefined) {
          sn.sprinting = Boolean(msg.sprint);
        }
      }
    }

    if (msg.t === "respawn") {
      if (validateInput(msg, sn, now)) {
        const fresh = makeSnake(sn.name);
        fresh.id = sn.id; // Keep id stable
        fresh.isBot = false; // Mark as player
        fresh.lastInputTime = Date.now();
        state.snakes.set(ws, fresh);
      }
    }
  });

  ws.on("close", () => {
    // Only delete if it's a player (not a bot)
    const sn = state.snakes.get(ws);
    if (sn && !sn.isBot) {
      state.snakes.delete(ws);
    }
  });
});

setInterval(stepServer, 1000 / TICK_HZ);
