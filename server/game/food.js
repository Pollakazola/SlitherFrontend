// Food entity and logic
const { FOOD, WORLD } = require('./constants');
const { rand, uid, dist2 } = require('./world');
const { SNAKE } = require('./constants');

function makeFood(size = null) {
  // Spawn food within circular barrier
  const { isInsideBarrier } = require('./world');
  let x, y;
  let attempts = 0;
  do {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(0, WORLD.barrierRadius * 0.95); // Spawn within 95% of barrier
    x = WORLD.centerX + Math.cos(angle) * radius;
    y = WORLD.centerY + Math.sin(angle) * radius;
    attempts++;
  } while (!isInsideBarrier(x, y) && attempts < 10);
  
  // Fallback to center if all attempts fail
  if (!isInsideBarrier(x, y)) {
    x = WORLD.centerX;
    y = WORLD.centerY;
  }
  
  return {
    id: uid(),
    x,
    y,
    size: size || FOOD.radius, // food size (radius), defaults to base food size
  };
}

function checkFoodCollisions(snakes, foodMap) {
  // Base collision radius (will be adjusted per snake based on width)
  const baseEatR2 = (SNAKE.radius + FOOD.radius) ** 2;

  for (const sn of snakes) {
    if (!sn.alive || !sn.segments.length) continue;
    const head = sn.segments[0];
    // Use dynamic width for food collision (wider snakes have larger eat radius)
    const snakeRadius = sn.width / 2;
    const eatR2 = (snakeRadius + FOOD.radius) ** 2;

    for (const [fid, f] of foodMap) {
      // Use food's actual size for collision
      const foodRadius = f.size || FOOD.radius;
      const foodEatR2 = (snakeRadius + foodRadius) ** 2;
      if (dist2(head.x, head.y, f.x, f.y) <= foodEatR2) {
        foodMap.delete(fid);
        // Respawn new food elsewhere
        const nf = makeFood();
        foodMap.set(nf.id, nf);

        sn.growthBank += 1; // Add food unit to growth bank (converts to score with exponential cost)
        // Width is calculated in updateSnake based on length (1% of length)
        break; // Only eat one food per tick
      }
    }
  }
}

function initFood(count) {
  const foodMap = new Map();
  for (let i = 0; i < count; i++) {
    const f = makeFood();
    foodMap.set(f.id, f);
  }
  return foodMap;
}

module.exports = {
  makeFood,
  checkFoodCollisions,
  initFood,
};
