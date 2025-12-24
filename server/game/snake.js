// Snake entity and logic
const { SNAKE, WORLD, DT, FOOD } = require('./constants');
const { rand, wrapPos, dist2, uid, isInsideBarrier } = require('./world');

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function makeSnake(name = "Player") {
  // Spawn within circular barrier
  const { isInsideBarrier } = require('./world');
  let x, y;
  let attempts = 0;
  do {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(0, WORLD.barrierRadius * 0.8); // Spawn within 80% of barrier
    x = WORLD.centerX + Math.cos(angle) * radius;
    y = WORLD.centerY + Math.sin(angle) * radius;
    attempts++;
  } while (!isInsideBarrier(x, y) && attempts < 10);
  
  // Fallback to center if all attempts fail
  if (!isInsideBarrier(x, y)) {
    x = WORLD.centerX;
    y = WORLD.centerY;
  }
  
  const angle = rand(0, Math.PI * 2);

  const segments = [];
  for (let i = 0; i < SNAKE.startLen; i++) {
    segments.push({
      x: x - Math.cos(angle) * i * SNAKE.segSpacing,
      y: y - Math.sin(angle) * i * SNAKE.segSpacing,
    });
  }

  return {
    id: uid(),
    name,
    hue: Math.floor(rand(0, 360)),
    alive: true,
    score: SNAKE.startLen, // Score equals segment count
    targetAngle: angle,
    angle,
    speed: SNAKE.baseSpeed,
    segments, // [0] is head
    lastInputTime: 0, // for rate limiting
    width: SNAKE.baseWidth, // current width (grows with food)
    sprinting: false, // Sprint state
    sprintFoodAccumulated: 0, // Accumulated food to drop (score units, drops every 2 seconds)
    growthBank: 0, // Accumulated food units for exponential growth conversion
  };
}

function updateSnake(sn, foodMap) {
  if (!sn.alive || !sn.segments || sn.segments.length === 0) return;

  // Set speed based on sprint state
  if (sn.sprinting) {
    sn.speed = 300; // Sprint speed
  } else {
    sn.speed = SNAKE.baseSpeed; // Normal speed
  }

  // Smooth turn toward targetAngle
  let da = sn.targetAngle - sn.angle;
  // Wrap angle difference to [-pi, pi]
  da = Math.atan2(Math.sin(da), Math.cos(da));
  const maxTurn = SNAKE.turnRate * DT;
  sn.angle += clamp(da, -maxTurn, maxTurn);

  const head = sn.segments[0];
  if (!head) return; // Safety check
  const nx = head.x + Math.cos(sn.angle) * sn.speed * DT;
  const ny = head.y + Math.sin(sn.angle) * sn.speed * DT;
  
  // Handle sprint: deduct score immediately (affects length directly) and accumulate food to drop
  if (sn.sprinting && sn.score > SNAKE.startLen) {
    const sprintCost = SNAKE.sprintCostPerSecond * DT; // Cost per tick
    // Deduct score immediately (affects length right away, but not below starting length)
    sn.score = Math.max(SNAKE.startLen, sn.score - sprintCost);
    
    if (sn.score > SNAKE.startLen) {
      
      // Accumulate food to drop (drops every 2 seconds)
      sn.sprintFoodAccumulated += sprintCost;
      const dropThreshold = SNAKE.sprintCostPerSecond * SNAKE.sprintFoodDropDelay; // 2 seconds worth (4 score)
      
      // When accumulated reaches threshold, drop food in area behind head
      if (sn.sprintFoodAccumulated >= dropThreshold) {
        const numFoodToDrop = Math.floor(sn.sprintFoodAccumulated); // Number of food items to drop
        sn.sprintFoodAccumulated -= numFoodToDrop; // Keep remainder in accumulator
        
        // Only drop if we have at least 1 food item worth
        if (numFoodToDrop > 0) {
        
        // Drop food in an area behind the head with width = snake width
        const dropAngle = sn.angle + Math.PI; // Opposite direction
        const dropDistance = SNAKE.sprintFoodDropDistance;
        const dropAreaWidth = sn.width; // Width of drop area = snake width
        
        for (let i = 0; i < numFoodToDrop; i++) {
          // Random position within drop area (rectangle behind head)
          // Perpendicular offset: random within [-width/2, width/2]
          const perpendicularAngle = sn.angle + Math.PI / 2; // Perpendicular to movement
          const offsetDist = (rand(0, 1) - 0.5) * dropAreaWidth; // Random offset within width
          
          let foodX = head.x + Math.cos(dropAngle) * dropDistance + Math.cos(perpendicularAngle) * offsetDist;
          let foodY = head.y + Math.sin(dropAngle) * dropDistance + Math.sin(perpendicularAngle) * offsetDist;
          
          // Ensure food is within barrier bounds
          const foodPos = { x: foodX, y: foodY };
          if (!isInsideBarrier(foodX, foodY)) {
            wrapPos(foodPos);
            foodX = foodPos.x;
            foodY = foodPos.y;
          }
          
          // Create food object with snake's hue
          const food = {
            id: uid(),
            x: foodX,
            y: foodY,
            size: FOOD.radius, // Use default food size
            hue: sn.hue, // Match snake's color
          };
          foodMap.set(food.id, food);
        }
      } // End if numFoodToDrop > 0
      }
    } else {
      // Not enough score to sprint, stop sprinting (accumulated food will be dropped in else-if below)
      sn.sprinting = false;
    }
  } else if (!sn.sprinting && sn.sprintFoodAccumulated > 0) {
    // If stopped sprinting but has accumulated food, drop it immediately
    const numFoodToDrop = Math.floor(sn.sprintFoodAccumulated);
    sn.sprintFoodAccumulated = 0;
    
    const dropAngle = sn.angle + Math.PI;
    const dropDistance = SNAKE.sprintFoodDropDistance;
    const dropAreaWidth = sn.width;
    
    for (let i = 0; i < numFoodToDrop; i++) {
      const perpendicularAngle = sn.angle + Math.PI / 2;
      const offsetDist = (rand(0, 1) - 0.5) * dropAreaWidth;
      
      let foodX = head.x + Math.cos(dropAngle) * dropDistance + Math.cos(perpendicularAngle) * offsetDist;
      let foodY = head.y + Math.sin(dropAngle) * dropDistance + Math.sin(perpendicularAngle) * offsetDist;
      
      const foodPos = { x: foodX, y: foodY };
      if (!isInsideBarrier(foodX, foodY)) {
        wrapPos(foodPos);
        foodX = foodPos.x;
        foodY = foodPos.y;
      }
      
      const food = {
        id: uid(),
        x: foodX,
        y: foodY,
        size: FOOD.radius,
        hue: sn.hue, // Match snake's color
      };
      foodMap.set(food.id, food);
    }
  }

  // Insert new head
  sn.segments.unshift({ x: nx, y: ny });

  // Convert growth bank to score with exponential cost
  if (sn.growthBank > 0) {
    // Calculate exponential cost for 1 segment of growth based on current score
    const growthCost = SNAKE.skipBaseCost * Math.pow(SNAKE.skipMultiplier, Math.floor(sn.score / SNAKE.skipScoreStep));
    
    // While we have enough banked food to grow, convert it to score
    while (sn.growthBank >= growthCost) {
      sn.growthBank -= growthCost;
      sn.score += 1; // Increase score (which directly increases length)
    }
  }

  // Ensure segment count exactly matches score (score = number of segments)
  const targetSegmentCount = Math.max(1, Math.floor(sn.score || 0)); // At least 1 segment, handle undefined score
  // We just added a head, so if we have more segments than target, remove the excess
  // Safety: ensure we don't remove all segments
  while (sn.segments.length > targetSegmentCount && sn.segments.length > 1) {
    sn.segments.pop(); // Remove excess segments to match score
  }

  // Enforce spacing (simple relaxation)
  for (let i = 1; i < sn.segments.length; i++) {
    const a = sn.segments[i - 1];
    const b = sn.segments[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const target = SNAKE.segSpacing;
    const diff = (d - target) / d;
    b.x -= dx * diff;
    b.y -= dy * diff;
  }

  wrapPos(sn.segments[0]);

  // Update width: starting width + 1% of (current length - starting length)
  const currentLength = sn.segments.length * SNAKE.segSpacing;
  const startingLength = SNAKE.startLen * SNAKE.segSpacing;
  sn.width = SNAKE.baseWidth + (currentLength - startingLength) * 0.01;
}

function checkCollisions(sn, allSnakes, foodMap) {
  if (!sn.alive || !sn.segments.length) return false;

  const head = sn.segments[0];
  // Use dynamic width for collision detection
  const headRadius = (sn.width / 2) * 1.05;
  const killR2 = headRadius ** 2;

  // Check barrier collision (circular boundary)
  const { isInsideBarrier } = require('./world');
  const dx = head.x - WORLD.centerX;
  const dy = head.y - WORLD.centerY;
  const distFromCenter = Math.hypot(dx, dy);
  const headDistFromBarrier = distFromCenter + headRadius;
  if (headDistFromBarrier > WORLD.barrierRadius) {
    return true; // collision with barrier
  }

  // Self-collision disabled: head can pass through own body

  // Check other snakes only
  for (const other of allSnakes) {
    if (other === sn || !other.alive) continue;
    const otherRadius = (other.width / 2) * 1.05;
    const otherKillR2 = otherRadius ** 2;
    for (let i = 0; i < other.segments.length; i++) {
      const seg = other.segments[i];
      // Use the larger of the two radii for collision
      const combinedR2 = Math.max(killR2, otherKillR2);
      if (dist2(head.x, head.y, seg.x, seg.y) <= combinedR2) {
        return true; // collision detected with another snake
      }
    }
  }

  return false;
}

function killSnake(sn, foodMap) {
  sn.alive = false;

  // Calculate food size based on snake's width/score (proportional to snake size)
  // Larger snakes drop larger food
  const { FOOD } = require('./constants');
  const baseFoodSize = FOOD.radius;
  // Scale food size based on snake width (normalized to base width)
  // Snake width ranges from baseWidth to maxWidth, so scale food proportionally
  const { SNAKE } = require('./constants');
  const widthRatio = Math.max(0, (sn.width - SNAKE.baseWidth) / (SNAKE.maxWidth - SNAKE.baseWidth));
  const maxFoodSize = baseFoodSize * 2.5; // Max food size is 2.5x base size (15 pixels)
  const foodSize = baseFoodSize + (widthRatio * (maxFoodSize - baseFoodSize));

  // Drop food along body with proportional sizes
  for (let i = 5; i < sn.segments.length; i += 3) {
    const seg = sn.segments[i];
    const f = {
      id: uid(),
      x: seg.x + rand(-8, 8),
      y: seg.y + rand(-8, 8),
      size: foodSize, // Proportional to snake size
    };
    foodMap.set(f.id, f);
  }
}

module.exports = {
  makeSnake,
  updateSnake,
  checkCollisions,
  killSnake,
};
