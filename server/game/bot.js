// Bot AI logic - ULTRA AGGRESSIVE ANTI-SPIRAL VERSION
const { dist2, isInsideBarrier, rand } = require('./world');
const { SNAKE, FOOD, DT, WORLD } = require('./constants');

// ULTRA AGGRESSIVE Constants
const STUCK_TIME_THRESHOLD = 0.15; // Detect stuck in 0.15 seconds
const MIN_PROGRESS_DISTANCE = 3; // Tiny progress required
const SPRINT_CHASE_DISTANCE = 400;
const SPRINT_ESCAPE_DISTANCE = 300;
const MIN_SPRINT_SCORE = 30;
const STUCK_ANGLE_CHANGE_THRESHOLD = 0.6; // VERY sensitive - detect spinning quickly
const POSITION_HISTORY_SIZE = 8; // Small history for fast detection
const MIN_TARGET_DISTANCE = 400; // Very large - force far targets
const RETARGET_COOLDOWN = 0.0; // No cooldown - immediate retargeting
const MAX_TARGET_HISTORY = 1; // Only remember last target
const CIRCULAR_PATTERN_THRESHOLD = 1.5; // HIGHER = less strict, detects more patterns (was 0.9)
const CIRCULAR_PATTERN_MIN_POINTS = 4; // Very few points needed
const FORCE_BREAK_DURATION = 2.0; // Force break direction for 2 seconds
const FORBIDDEN_ANGLE_RANGE = Math.PI / 2; // 90 degree forbidden zone
const REPETITIVE_MOVEMENT_THRESHOLD = 50; // Distance threshold for repetitive movement
const MAX_POSITION_REVISITS = 3; // Max times we can revisit same area
const SCORE_STAGNATION_TIME = 2.0; // Seconds without score change to trigger wander
const WANDER_DISTANCE = 500; // Distance to move in random direction when score stagnant

/**
 * Validate a number is finite and valid
 */
function isValidNumber(value) {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

/**
 * Validate coordinates are within world bounds
 */
function isValidPosition(x, y) {
  return isValidNumber(x) && isValidNumber(y) &&
         x >= 0 && x <= WORLD.w &&
         y >= 0 && y <= WORLD.h;
}

/**
 * Validate food object is valid
 */
function isValidFood(food) {
  return food &&
         typeof food === 'object' &&
         isValidPosition(food.x, food.y) &&
         isInsideBarrier(food.x, food.y);
}

/**
 * Safely calculate distance squared between two points
 */
function safeDist2(ax, ay, bx, by) {
  if (!isValidNumber(ax) || !isValidNumber(ay) ||
      !isValidNumber(bx) || !isValidNumber(by)) {
    return Infinity;
  }
  return dist2(ax, ay, bx, by);
}

/**
 * Safely calculate angle between two points
 */
function safeAngle(dx, dy) {
  if (!isValidNumber(dx) || !isValidNumber(dy)) {
    return 0;
  }
  const angle = Math.atan2(dy, dx);
  return isValidNumber(angle) ? angle : 0;
}

/**
 * Wrap angle to [0, 2*PI]
 */
function wrapAngle(angle) {
  while (angle < 0) angle += 2 * Math.PI;
  while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
  return angle;
}

/**
 * Calculate angle difference (smallest)
 */
function angleDifference(a1, a2) {
  let diff = Math.abs(a1 - a2);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff;
}

/**
 * Initialize bot properties
 */
function initializeBotProperties(snake) {
  if (!snake) return;
  
  if (snake.targetFoodId === undefined) snake.targetFoodId = null;
  if (snake.stuckStartTime === undefined) snake.stuckStartTime = null;
  if (snake.initialCloseDistance === undefined || !isValidNumber(snake.initialCloseDistance)) {
    snake.initialCloseDistance = Infinity;
  }
  if (snake.closestFoodDistance === undefined || !isValidNumber(snake.closestFoodDistance)) {
    snake.closestFoodDistance = Infinity;
  }
  if (!Array.isArray(snake.targetFoodHistory)) snake.targetFoodHistory = [];
  if (!Array.isArray(snake.positionHistory)) snake.positionHistory = [];
  if (snake.lastAngle === undefined || !isValidNumber(snake.lastAngle)) snake.lastAngle = null;
  if (snake.cumulativeAngleChange === undefined || !isValidNumber(snake.cumulativeAngleChange)) {
    snake.cumulativeAngleChange = 0;
  }
  if (snake.lastRetargetTime === undefined || !isValidNumber(snake.lastRetargetTime)) {
    snake.lastRetargetTime = 0;
  }
  if (snake.forceBreakAngle === undefined || !isValidNumber(snake.forceBreakAngle)) {
    snake.forceBreakAngle = null;
  }
  if (snake.forceBreakStartTime === undefined || !isValidNumber(snake.forceBreakStartTime)) {
    snake.forceBreakStartTime = null;
  }
  if (snake.forbiddenAngles === undefined || !Array.isArray(snake.forbiddenAngles)) {
    snake.forbiddenAngles = [];
  }
  if (snake.lastScore === undefined || !isValidNumber(snake.lastScore)) {
    snake.lastScore = isValidNumber(snake.score) ? snake.score : 0;
  }
  if (snake.lastScoreChangeTime === undefined || !isValidNumber(snake.lastScoreChangeTime)) {
    snake.lastScoreChangeTime = null;
  }
  if (snake.wanderMode === undefined) {
    snake.wanderMode = false;
  }
  if (snake.wanderStartPosition === undefined || !snake.wanderStartPosition) {
    snake.wanderStartPosition = null;
  }
  if (snake.wanderAngle === undefined || !isValidNumber(snake.wanderAngle)) {
    snake.wanderAngle = null;
  }
}

/**
 * Detect repetitive movement (revisiting same areas)
 */
function detectRepetitiveMovement(positionHistory) {
  if (!Array.isArray(positionHistory) || positionHistory.length < 6) {
    return false;
  }

  const validPositions = positionHistory.filter(p => p && isValidPosition(p.x, p.y));
  if (validPositions.length < 6) return false;

  // Check if we're revisiting positions (within threshold distance)
  const recentPositions = validPositions.slice(-6);
  const olderPositions = validPositions.slice(0, -6);
  
  let revisitCount = 0;
  for (const recent of recentPositions) {
    for (const older of olderPositions) {
      const dist = Math.sqrt(safeDist2(recent.x, recent.y, older.x, older.y));
      if (dist < REPETITIVE_MOVEMENT_THRESHOLD) {
        revisitCount++;
        break; // Count each recent position only once
      }
    }
  }

  // If we've revisited more than half of recent positions, we're stuck
  return revisitCount >= recentPositions.length / 2;
}

/**
 * Detect circular pattern - ULTRA SENSITIVE
 */
function detectCircularPattern(positionHistory) {
  if (!Array.isArray(positionHistory) || positionHistory.length < CIRCULAR_PATTERN_MIN_POINTS) {
    return { isCircular: false, center: null, radius: 0, breakAngle: 0 };
  }

  // Get valid positions
  const validPositions = positionHistory.filter(p => p && isValidPosition(p.x, p.y));
  if (validPositions.length < CIRCULAR_PATTERN_MIN_POINTS) {
    return { isCircular: false, center: null, radius: 0, breakAngle: 0 };
  }

  // Calculate center
  let sumX = 0, sumY = 0;
  for (const pos of validPositions) {
    sumX += pos.x;
    sumY += pos.y;
  }
  const centerX = sumX / validPositions.length;
  const centerY = sumY / validPositions.length;

  // Calculate distances from center
  const distances = [];
  for (const pos of validPositions) {
    const dx = pos.x - centerX;
    const dy = pos.y - centerY;
    const dist = Math.hypot(dx, dy);
    if (isFinite(dist) && dist > 15) { // Minimum radius
      distances.push(dist);
    }
  }

  if (distances.length < CIRCULAR_PATTERN_MIN_POINTS) {
    return { isCircular: false, center: null, radius: 0, breakAngle: 0 };
  }

  // Calculate variance
  const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDist, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgDist > 0 ? stdDev / avgDist : Infinity;

  // HIGHER threshold = less strict = detects more patterns
  const isCircular = coefficientOfVariation < CIRCULAR_PATTERN_THRESHOLD && avgDist > 15;

  // Calculate break angle (radial outward from center)
  let breakAngle = 0;
  if (isCircular && validPositions.length > 0) {
    const lastPos = validPositions[validPositions.length - 1];
    const dx = lastPos.x - centerX;
    const dy = lastPos.y - centerY;
    breakAngle = safeAngle(dx, dy);
  }

  return {
    isCircular,
    center: isCircular ? { x: centerX, y: centerY } : null,
    radius: isCircular ? avgDist : 0,
    breakAngle
  };
}

/**
 * Check if angle is in forbidden zone
 */
function isAngleForbidden(angle, forbiddenAngles) {
  if (!Array.isArray(forbiddenAngles) || forbiddenAngles.length === 0) return false;
  
  for (const forbidden of forbiddenAngles) {
    if (isValidNumber(forbidden)) {
      const diff = angleDifference(angle, forbidden);
      if (diff < FORBIDDEN_ANGLE_RANGE) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find nearest food avoiding forbidden directions
 */
function findNearestFood(head, foodMap, excludeIds = [], forbiddenAngles = []) {
  if (!head || !isValidPosition(head.x, head.y) || !foodMap || foodMap.size === 0) {
    return { food: null, foodId: null, distance: Infinity };
  }

  let nearestFood = null;
  let nearestFoodId = null;
  let nearestDist2 = Infinity;

  for (const [fid, food] of foodMap) {
    if (excludeIds.includes(fid)) continue;
    if (!isValidFood(food)) continue;
    
    const dx = food.x - head.x;
    const dy = food.y - head.y;
    const foodAngle = safeAngle(dx, dy);
    
    // Skip if in forbidden direction
    if (isAngleForbidden(foodAngle, forbiddenAngles)) continue;
    
    const d2 = safeDist2(head.x, head.y, food.x, food.y);
    
    if (d2 < nearestDist2 && isFinite(d2)) {
      nearestDist2 = d2;
      nearestFood = food;
      nearestFoodId = fid;
    }
  }

  return {
    food: nearestFood,
    foodId: nearestFoodId,
    distance: isFinite(nearestDist2) ? Math.sqrt(nearestDist2) : Infinity
  };
}

/**
 * Find food in a specific direction (for forced break)
 */
function findFoodInDirection(head, foodMap, directionAngle, excludeIds = [], minDistance = 0) {
  if (!head || !isValidPosition(head.x, head.y) || !foodMap || foodMap.size === 0) {
    return { food: null, foodId: null, distance: Infinity };
  }

  let bestFood = null;
  let bestFoodId = null;
  let bestScore = -Infinity;

  for (const [fid, food] of foodMap) {
    if (excludeIds.includes(fid)) continue;
    if (!isValidFood(food)) continue;
    
    const dx = food.x - head.x;
    const dy = food.y - head.y;
    const distance = Math.sqrt(safeDist2(head.x, head.y, food.x, food.y));
    
    if (distance < minDistance) continue;
    
    const foodAngle = safeAngle(dx, dy);
    const angleDiff = angleDifference(foodAngle, directionAngle);
    
    // Prefer food in the specified direction
    const directionScore = 1.0 / (angleDiff + 0.1);
    const distanceScore = 1.0 / (distance + 1);
    
    const score = directionScore * distanceScore;
    
    if (score > bestScore) {
      bestScore = score;
      bestFood = food;
      bestFoodId = fid;
    }
  }

  return {
    food: bestFood,
    foodId: bestFoodId,
    distance: bestFood ? Math.sqrt(safeDist2(head.x, head.y, bestFood.x, bestFood.y)) : Infinity
  };
}

/**
 * Update bot AI - ULTRA AGGRESSIVE VERSION
 */
function updateBotAI(snake, foodMap, allSnakes) {
  // Input validation
  if (!snake || typeof snake !== 'object' || !snake.alive) {
    if (snake && snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }
  
  if (!Array.isArray(snake.segments) || snake.segments.length === 0) {
    if (snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }

  const head = snake.segments[0];
  if (!head || !isValidPosition(head.x, head.y)) {
    if (snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }
  
  if (!foodMap || typeof foodMap.size !== 'number' || foodMap.size === 0) {
    if (snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }
  
  if (!Array.isArray(allSnakes)) {
    allSnakes = [];
  }

  // Get current time
  let currentTime;
  try {
    currentTime = Date.now() / 1000;
    if (!isValidNumber(currentTime)) currentTime = 0;
  } catch (e) {
    currentTime = 0;
  }

  // Initialize properties
  initializeBotProperties(snake);

  // SCORE STAGNATION DETECTION: Check if score hasn't changed for 2 seconds
  const currentScore = isValidNumber(snake.score) ? snake.score : 0;
  const scoreChanged = currentScore !== snake.lastScore;
  
  if (scoreChanged) {
    // Score changed - update tracking
    snake.lastScore = currentScore;
    snake.lastScoreChangeTime = currentTime;
    // Exit wander mode if score changed
    if (snake.wanderMode) {
      snake.wanderMode = false;
      snake.wanderStartPosition = null;
      snake.wanderAngle = null;
    }
  } else {
    // Score hasn't changed - check if we should enter wander mode
    if (snake.lastScoreChangeTime === null) {
      snake.lastScoreChangeTime = currentTime;
    }
    
    const timeSinceScoreChange = currentTime - snake.lastScoreChangeTime;
    
    if (timeSinceScoreChange >= SCORE_STAGNATION_TIME && !snake.wanderMode) {
      // Enter wander mode - choose random direction
      snake.wanderMode = true;
      snake.wanderStartPosition = { x: head.x, y: head.y };
      snake.wanderAngle = Math.random() * Math.PI * 2; // Random direction
      snake.targetFoodId = null; // Clear current target
      snake.stuckStartTime = null;
      snake.cumulativeAngleChange = 0;
      snake.positionHistory = [];
    }
  }

  // WANDER MODE: Move in random direction for WANDER_DISTANCE
  if (snake.wanderMode && snake.wanderStartPosition && isValidPosition(snake.wanderStartPosition.x, snake.wanderStartPosition.y)) {
    const distanceTraveled = Math.sqrt(safeDist2(
      head.x, head.y,
      snake.wanderStartPosition.x, snake.wanderStartPosition.y
    ));
    
    if (distanceTraveled >= WANDER_DISTANCE) {
      // Reached wander distance - exit wander mode and resume eating
      snake.wanderMode = false;
      snake.wanderStartPosition = null;
      snake.wanderAngle = null;
      snake.targetFoodId = null; // Will find new target below
      snake.lastScoreChangeTime = currentTime; // Reset timer
    } else {
      // Still wandering - go in wander direction
      if (snake.wanderAngle !== null && isValidNumber(snake.wanderAngle)) {
        snake.targetAngle = snake.wanderAngle;
        if (snake.sprinting !== undefined) snake.sprinting = false;
        return; // Skip normal food targeting while wandering
      }
    }
  }

  // Track position history
  if (Array.isArray(snake.positionHistory)) {
    snake.positionHistory.push({ x: head.x, y: head.y, time: currentTime });
    while (snake.positionHistory.length > POSITION_HISTORY_SIZE) {
      snake.positionHistory.shift();
    }
  }

  // IMMEDIATELY detect circular pattern and repetitive movement
  const circularPattern = detectCircularPattern(snake.positionHistory);
  const isInCircle = circularPattern.isCircular;
  const isRepetitive = detectRepetitiveMovement(snake.positionHistory);
  const isStuckPattern = isInCircle || isRepetitive;

  // Track angle changes
  if (snake.lastAngle !== null && isValidNumber(snake.lastAngle)) {
    if (snake.targetAngle !== undefined && isValidNumber(snake.targetAngle)) {
      let angleDiff = snake.targetAngle - snake.lastAngle;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      if (isValidNumber(angleDiff)) {
        snake.cumulativeAngleChange = (snake.cumulativeAngleChange || 0) + Math.abs(angleDiff);
        if (Math.abs(angleDiff) < 0.03) {
          snake.cumulativeAngleChange *= 0.3; // Aggressive decay
        }
      }
    }
  }
  
  if (snake.targetAngle !== undefined && isValidNumber(snake.targetAngle)) {
    snake.lastAngle = snake.targetAngle;
  }

  // FORCE BREAK MODE: If circular pattern or repetitive movement detected, immediately force break
  let breakAngle = null;
  if (isInCircle && isValidNumber(circularPattern.breakAngle)) {
    breakAngle = circularPattern.breakAngle;
  } else if (isRepetitive && snake.positionHistory.length > 0) {
    // For repetitive movement, break in opposite direction of current movement
    const recent = snake.positionHistory.slice(-3);
    if (recent.length >= 2) {
      const dx = recent[recent.length - 1].x - recent[0].x;
      const dy = recent[recent.length - 1].y - recent[0].y;
      const currentDir = safeAngle(dx, dy);
      breakAngle = currentDir + Math.PI + rand(-Math.PI / 3, Math.PI / 3); // Opposite + random
      breakAngle = Math.atan2(Math.sin(breakAngle), Math.cos(breakAngle));
    }
  }
  
  if (isStuckPattern && isValidNumber(breakAngle)) {
    // Set force break angle
    if (snake.forceBreakAngle === null || snake.forceBreakStartTime === null) {
      snake.forceBreakAngle = breakAngle;
      snake.forceBreakStartTime = currentTime;
      
      // Add current direction to forbidden angles
      if (snake.targetAngle !== undefined && isValidNumber(snake.targetAngle)) {
        snake.forbiddenAngles.push(snake.targetAngle);
        // Keep only recent forbidden angles
        while (snake.forbiddenAngles.length > 3) {
          snake.forbiddenAngles.shift();
        }
      }
      
      // Clear target
    snake.targetFoodId = null;
    snake.stuckStartTime = null;
    snake.cumulativeAngleChange = 0;
      snake.positionHistory = [];
    }
    
    // Check if force break duration expired
    const forceBreakDuration = currentTime - snake.forceBreakStartTime;
    if (forceBreakDuration > FORCE_BREAK_DURATION) {
      snake.forceBreakAngle = null;
      snake.forceBreakStartTime = null;
      // Clear some forbidden angles after break
      if (snake.forbiddenAngles.length > 0) {
        snake.forbiddenAngles.shift();
      }
    }
  } else {
    // Not in circle, clear force break if it exists
    if (snake.forceBreakAngle !== null) {
      snake.forceBreakAngle = null;
      snake.forceBreakStartTime = null;
    }
  }

  // Check if currently targeted food still exists
  let targetFood = null;
  if (snake.targetFoodId) {
    targetFood = foodMap.get(snake.targetFoodId);
    if (!isValidFood(targetFood)) {
      targetFood = null;
          snake.targetFoodId = null;
          snake.stuckStartTime = null;
          snake.initialCloseDistance = Infinity;
          snake.closestFoodDistance = Infinity;
    }
  }

  // FORCE BREAK MODE: Go in forced direction
  if (snake.forceBreakAngle !== null && isValidNumber(snake.forceBreakAngle)) {
    // Try to find food in break direction
    const breakFood = findFoodInDirection(
      head, 
      foodMap, 
      snake.forceBreakAngle, 
      snake.targetFoodHistory || [],
      MIN_TARGET_DISTANCE
    );
    
    if (breakFood.food && breakFood.foodId) {
      targetFood = breakFood.food;
      snake.targetFoodId = breakFood.foodId;
      snake.stuckStartTime = null;
      snake.initialCloseDistance = breakFood.distance;
      snake.closestFoodDistance = breakFood.distance;
    } else {
      // No food in direction, just go that way
      snake.targetAngle = snake.forceBreakAngle;
      if (snake.sprinting !== undefined) snake.sprinting = false;
      return;
    }
  }

  // Normal mode: Find or update target
  if (!targetFood) {
    const result = findNearestFood(
      head, 
      foodMap, 
      snake.targetFoodHistory || [], 
      snake.forbiddenAngles || []
    );
    
    if (result.food && result.foodId && isFinite(result.distance)) {
      targetFood = result.food;
      snake.targetFoodId = result.foodId;
      snake.stuckStartTime = null;
      snake.initialCloseDistance = result.distance;
      snake.closestFoodDistance = result.distance;
      snake.cumulativeAngleChange = 0;
      snake.positionHistory = [];
      snake.lastAngle = null;
      snake.lastTargetPosition = { x: targetFood.x, y: targetFood.y };
    } else {
      if (snake.sprinting !== undefined) snake.sprinting = false;
      return;
    }
  }

  // Validate target
  if (!targetFood || !isValidFood(targetFood)) {
    if (snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }

  // Calculate distance to target
  const currentDist2 = safeDist2(head.x, head.y, targetFood.x, targetFood.y);
  const currentDist = isFinite(currentDist2) ? Math.sqrt(currentDist2) : Infinity;

  if (!isFinite(currentDist)) {
    snake.targetFoodId = null;
    if (snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }

  // Track progress
    if (snake.stuckStartTime === null) {
      snake.stuckStartTime = currentTime;
      snake.initialCloseDistance = currentDist;
      snake.closestFoodDistance = currentDist;
    } else {
    if (isValidNumber(snake.closestFoodDistance) && currentDist < snake.closestFoodDistance) {
        snake.closestFoodDistance = currentDist;
    }
  }

  // AGGRESSIVE stuck detection
  const isSpinning = isValidNumber(snake.cumulativeAngleChange) && 
                    snake.cumulativeAngleChange > STUCK_ANGLE_CHANGE_THRESHOLD;
  
  const hasBeenTargeting = snake.stuckStartTime !== null && isValidNumber(snake.stuckStartTime);
  const stuckDuration = hasBeenTargeting ? Math.max(0, currentTime - snake.stuckStartTime) : 0;
  const progressMade = isValidNumber(snake.initialCloseDistance) && isValidNumber(snake.closestFoodDistance) ?
    Math.max(0, snake.initialCloseDistance - snake.closestFoodDistance) : 0;
  
  const isStuck = (stuckDuration > STUCK_TIME_THRESHOLD && progressMade < MIN_PROGRESS_DISTANCE) || 
                 isSpinning;

  const timeSinceLastRetarget = isValidNumber(currentTime) && isValidNumber(snake.lastRetargetTime) ?
    Math.max(0, currentTime - snake.lastRetargetTime) : Infinity;
  const canRetarget = isStuckPattern || isSpinning || timeSinceLastRetarget >= RETARGET_COOLDOWN;

  // AGGRESSIVE retargeting
  if (isStuck && canRetarget && snake.forceBreakAngle === null) {
    // Add to history
    if (Array.isArray(snake.targetFoodHistory) && snake.targetFoodId &&
        snake.targetFoodHistory.indexOf(snake.targetFoodId) === -1) {
            snake.targetFoodHistory.push(snake.targetFoodId);
      while (snake.targetFoodHistory.length > MAX_TARGET_HISTORY) {
              snake.targetFoodHistory.shift();
            }
          }
          
    // Calculate break angle (use detected break angle or calculate new one)
    let retargetBreakAngle = breakAngle;
    if (!isValidNumber(retargetBreakAngle)) {
      // Random direction at least 90 degrees from current
      const currentAngle = snake.targetAngle !== undefined && isValidNumber(snake.targetAngle) ? 
                          snake.targetAngle : Math.random() * Math.PI * 2;
      retargetBreakAngle = currentAngle + Math.PI + rand(-Math.PI / 2, Math.PI / 2);
      retargetBreakAngle = Math.atan2(Math.sin(retargetBreakAngle), Math.cos(retargetBreakAngle));
    }

    // Find food far away in break direction
    const breakFood = findFoodInDirection(
      head,
      foodMap,
      retargetBreakAngle,
      snake.targetFoodHistory || [],
      MIN_TARGET_DISTANCE
    );

    if (breakFood.food && breakFood.foodId) {
      targetFood = breakFood.food;
      snake.targetFoodId = breakFood.foodId;
            snake.stuckStartTime = null;
      snake.initialCloseDistance = breakFood.distance;
      snake.closestFoodDistance = breakFood.distance;
            snake.cumulativeAngleChange = 0;
            snake.positionHistory = [];
            snake.lastRetargetTime = currentTime;
            snake.lastAngle = null;
          } else {
      // No food found, force break mode
      snake.forceBreakAngle = retargetBreakAngle;
      snake.forceBreakStartTime = currentTime;
      snake.targetFoodId = null;
      snake.stuckStartTime = null;
      snake.cumulativeAngleChange = 0;
      snake.positionHistory = [];
    }
  }

  // Calculate angle to target
  if (!targetFood || !isValidFood(targetFood)) {
    if (snake.sprinting !== undefined) snake.sprinting = false;
    return;
  }

  let dx = targetFood.x - head.x;
  let dy = targetFood.y - head.y;
  let targetAngle = safeAngle(dx, dy);

  // If in force break mode, use break angle directly (100%)
  if (snake.forceBreakAngle !== null && isValidNumber(snake.forceBreakAngle)) {
    targetAngle = snake.forceBreakAngle;
  } else if (isStuckPattern && isValidNumber(breakAngle)) {
    // In stuck pattern but not in force break - use break angle directly
    targetAngle = breakAngle;
  }

  // Update target angle
  if (isValidNumber(targetAngle)) {
  snake.targetAngle = targetAngle;
  }

  // Sprint logic
  let nearestThreatDistance = Infinity;
  if (Array.isArray(allSnakes)) {
  for (const other of allSnakes) {
      if (!other || other === snake || !other.alive) continue;
      if (!Array.isArray(other.segments) || other.segments.length === 0) continue;
      
    const otherHead = other.segments[0];
      if (!otherHead || !isValidPosition(otherHead.x, otherHead.y)) continue;
      
      const threatDist2 = safeDist2(head.x, head.y, otherHead.x, otherHead.y);
      if (!isFinite(threatDist2)) continue;
    
    const threatDist = Math.sqrt(threatDist2);
      const otherScore = isValidNumber(other.score) ? other.score : 0;
      const snakeScore = isValidNumber(snake.score) ? snake.score : 0;
    
      if (isFinite(threatDist) && threatDist < nearestThreatDistance && otherScore >= snakeScore * 0.8) {
      nearestThreatDistance = threatDist;
      }
    }
  }

  const snakeScore = isValidNumber(snake.score) ? snake.score : 0;
  const startLen = isValidNumber(SNAKE.startLen) ? SNAKE.startLen : 20;

  const shouldSprintForFood = isFinite(currentDist) &&
                              currentDist < SPRINT_CHASE_DISTANCE && 
                              snakeScore >= MIN_SPRINT_SCORE &&
                              snakeScore > startLen;
  
  const shouldSprintToEscape = isFinite(nearestThreatDistance) &&
                               nearestThreatDistance < SPRINT_ESCAPE_DISTANCE &&
                               snakeScore >= MIN_SPRINT_SCORE &&
                               snakeScore > startLen;

  if (shouldSprintToEscape) {
    snake.sprinting = true;
  } else if (shouldSprintForFood && !shouldSprintToEscape) {
    snake.sprinting = true;
  } else {
    snake.sprinting = false;
  }
}

/**
 * Check if a snake is a bot
 */
function isBot(snake) {
  if (!snake || typeof snake !== 'object') {
    return false;
  }
  return snake.isBot === true || snake.targetFoodId !== undefined;
}

module.exports = {
  updateBotAI,
  isBot,
};
