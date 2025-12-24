// Network utilities and message handling
const { NET, WORLD, FOOD } = require('./constants');

function snapshotForClient(snakes, food) {
  // Keep payload small: send head + a subset of segments
  const snakeList = [];
  for (const sn of snakes.values()) {
    if (!sn.alive) continue;
    const step = NET.snapshotDownsample;
    const segs = [];
    for (let i = 0; i < sn.segments.length; i += step) {
      segs.push([sn.segments[i].x, sn.segments[i].y]);
    }
    snakeList.push({
      id: sn.id,
      name: sn.name,
      hue: sn.hue,
      score: sn.score,
      width: sn.width, // include width for rendering
      sprinting: sn.sprinting, // include sprinting state for color brightening
      segs,
    });
  }

  const foodList = [];
  for (const f of food.values()) {
    // Include food size and hue in snapshot: [x, y, id, size, hue] (hue optional)
    foodList.push([f.x, f.y, f.id, f.size || FOOD.radius, f.hue || null]);
  }

  return {
    snakes: snakeList,
    food: foodList,
    world: WORLD,
  };
}

function broadcast(wss, msgObj) {
  const data = JSON.stringify(msgObj);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  }
}

function validateInput(msg, snake, now) {
  // Rate limiting: max NET.inputRateLimit messages per second
  const minInterval = 1000 / NET.inputRateLimit;
  if (now - snake.lastInputTime < minInterval) {
    return false;
  }

  // Validate angle and sprint
  if (msg.t === "input") {
    const a = Number(msg.a);
    if (!Number.isFinite(a)) return false;
    // sprint is optional boolean
    if (msg.sprint !== undefined && typeof msg.sprint !== 'boolean') return false;
    snake.lastInputTime = now;
    return true;
  }

  // Validate join
  if (msg.t === "join") {
    const name = String(msg.name || "Guest").slice(0, 18);
    if (name.length === 0) return false;
    return true;
  }

  // Respawn is always valid if dead
  if (msg.t === "respawn") {
    return !snake.alive;
  }

  // Temporary: feed button validation (always valid if alive)
  if (msg.t === "feed") {
    return snake.alive;
  }

  return false;
}

module.exports = {
  snapshotForClient,
  broadcast,
  validateInput,
};
