// Main server entry point
const WebSocket = require("ws");
const { PORT, TICK_HZ, FOOD, BOT } = require('./game/constants');
const { makeSnake, updateSnake, checkCollisions, killSnake } = require('./game/snake');
const { initFood, checkFoodCollisions, updateFood } = require('./game/food');
const { snapshotForClient, broadcast, validateInput } = require('./game/net');
const { updateBotAI, isBot } = require('./game/bot');
const { WORLD } = require('./game/constants');

const wss = new WebSocket.Server({ port: PORT });
console.log(`Server listening on ws://localhost:${PORT}`);

const state = {
  snakes: new Map(), // socket -> snake (or botId string for bots)
  food: initFood(FOOD.count),
};

let botCounter = 0; // Counter for unique bot keys

// Function to create a bot snake
function createBot() {
  const botNames = ['Bot1', 'Bot2', 'Bot3', 'Bot4', 'Bot5', 'Bot6', 'Bot7', 'Bot8', 'Bot9', 'Bot10'];
  const randomName = botNames[Math.floor(Math.random() * botNames.length)] + Math.floor(Math.random() * 100);
  const bot = makeSnake(randomName);
  bot.isBot = true;
  bot.lastInputTime = 0;
  // Use unique bot key (string starting with "bot_")
  const botKey = `bot_${botCounter++}`;
  state.snakes.set(botKey, bot);
  return { bot, botKey };
}

// Function to initialize bots
function initializeBots() {
  const botCount = BOT.count || 10;
  for (let i = 0; i < botCount; i++) {
    createBot();
  }
  console.log(`Initialized ${botCount} bots`);
}

// Function to maintain minimum bot count
function maintainBots() {
  const botCount = [...state.snakes.values()].filter(sn => sn && sn.isBot === true).length;
  const minCount = BOT.minCount || 8;
  
  if (botCount < minCount) {
    const needed = minCount - botCount;
    for (let i = 0; i < needed; i++) {
      createBot();
    }
    if (needed > 0) {
      console.log(`Added ${needed} bots to maintain minimum count`);
    }
  }
}

// Function to respawn all bots
function respawnAllBots() {
  let respawnedCount = 0;
  const botEntries = [];
  
  // Collect all bot entries (bots have string keys starting with "bot_")
  for (const [key, sn] of state.snakes) {
    if (typeof key === 'string' && key.startsWith('bot_') && sn && sn.isBot === true) {
      botEntries.push({ key, sn });
    }
  }
  
  // Respawn each bot
  for (const { key, sn } of botEntries) {
    const fresh = makeSnake(sn.name);
    fresh.id = sn.id; // Keep id stable
    fresh.isBot = true;
    fresh.lastInputTime = 0;
    state.snakes.set(key, fresh);
    respawnedCount++;
  }
  
  console.log(`Respawned ${respawnedCount} bots`);
  return respawnedCount;
}

function stepServer() {
  // Update bot AI for all bots
  const allSnakes = [...state.snakes.values()].filter(s => s);
  for (const sn of allSnakes) {
    if (sn.isBot === true && sn.alive) {
      updateBotAI(sn, state.food, allSnakes);
    }
  }

  // Move all snakes
  for (const [, sn] of state.snakes) {
    if (sn) {
      updateSnake(sn, state.food);
    }
  }

  // Update food positions (for explosion food with velocity)
  updateFood(state.food);

  // Check food collisions
  checkFoodCollisions(allSnakes, state.food);

  // Check snake collisions
  const aliveSnakes = allSnakes.filter(s => s && s.alive);
  for (const sn of aliveSnakes) {
    if (checkCollisions(sn, aliveSnakes, state.food)) {
      killSnake(sn, state.food);
    }
  }

  // Maintain minimum bot count
  maintainBots();

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
        // Handle skinId if provided
        if (msg.skinId !== undefined) {
          sn.skinId = String(msg.skinId || "default");
        }
      }
    }

    if (msg.t === "input") {
      if (validateInput(msg, sn, now)) {
        const a = Number(msg.a);
        sn.targetAngle = a;
        // Handle sprint flag from client
        if (msg.sprint !== undefined) {
          sn.sprinting = Boolean(msg.sprint);
        }
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
    // Only delete if it's a real player (WebSocket), not a bot
    if (state.snakes.has(ws)) {
      state.snakes.delete(ws);
    }
  });
});

setInterval(stepServer, 1000 / TICK_HZ);

// Initialize bots on server start
initializeBots();

// Make respawnAllBots available globally for console access
global.respawnAllBots = respawnAllBots;
