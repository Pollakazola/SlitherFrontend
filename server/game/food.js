// Food entity and logic
const { FOOD, WORLD, DT } = require('./constants');
const { rand, uid, dist2, wrapPos, isInsideBarrier } = require('./world');
const { SNAKE } = require('./constants');

function makeFood(size = null) {
  // Spawn food within circular barrier
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
    vx: 0, // Velocity X (default 0 for static food)
    vy: 0, // Velocity Y (default 0 for static food)
    explosionTime: 0, // Time since explosion (0 for non-exploding food)
    isExploding: false, // Flag to indicate if this is explosion food
  };
}

function updateFood(foodMap) {
  // Deceleration factor: food slows down over time
  const friction = 0.92; // Multiplier per frame (92% of speed remains each frame)
  const minSpeed = 5; // Minimum speed threshold - stop below this
  
  for (const f of foodMap.values()) {
    // Initialize velocity properties if they don't exist (backward compatibility)
    if (f.vx === undefined) f.vx = 0;
    if (f.vy === undefined) f.vy = 0;
    if (f.explosionTime === undefined) f.explosionTime = 0;
    if (f.isExploding === undefined) f.isExploding = false;
    
    // Only update food with velocity
    if (f.vx !== 0 || f.vy !== 0 || f.isExploding) {
      // Update explosion time
      if (f.isExploding) {
        f.explosionTime = (f.explosionTime || 0) + DT;
      }
      
      // Apply friction to slow down food
      const speed = Math.hypot(f.vx, f.vy);
      if (speed > minSpeed) {
        f.vx *= friction;
        f.vy *= friction;
        
        // Update position
        f.x += f.vx * DT;
        f.y += f.vy * DT;
        
        // Keep food within barrier bounds
        const foodPos = { x: f.x, y: f.y };
        if (!isInsideBarrier(f.x, f.y)) {
          wrapPos(foodPos);
          f.x = foodPos.x;
          f.y = foodPos.y;
          // Stop velocity when hitting barrier
          f.vx = 0;
          f.vy = 0;
          f.isExploding = false;
        }
      } else {
        // Stop food below minimum speed threshold
        f.vx = 0;
        f.vy = 0;
        // Keep explosion flag for rendering effects, but mark as settled
        if ((f.explosionTime || 0) > 0.5) { // After 0.5 seconds, stop explosion effect
          f.isExploding = false;
        }
      }
    }
  }
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
  updateFood,
};
