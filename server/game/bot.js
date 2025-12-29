// Bot AI logic for automatic food targeting
const { dist2 } = require('./world');
const { SNAKE, FOOD, DT } = require('./constants');

// Constants for bot behavior
const CLOSE_PROXIMITY_DISTANCE = 300; // Distance considered "close" to food (in world units)
const STUCK_TIME_THRESHOLD = 1.0; // Seconds before retargeting (very aggressive)
const MIN_PROGRESS_DISTANCE = 20; // Minimum distance improvement needed to avoid retargeting (in world units)
const SPRINT_CHASE_DISTANCE = 400; // Distance to food to consider sprinting
const SPRINT_ESCAPE_DISTANCE = 300; // Distance to enemy snake to consider sprinting to escape
const MIN_SPRINT_SCORE = 30; // Minimum score needed before bots will sprint (need some buffer)
const STUCK_ANGLE_CHANGE_THRESHOLD = 2.0; // Radians of cumulative angle change to detect spinning (more sensitive)
const POSITION_HISTORY_SIZE = 15; // Number of recent positions to track for spiral detection
const MIN_TARGET_DISTANCE = 50; // Minimum distance a new target must be from current target
const RETARGET_COOLDOWN = 0.5; // Minimum seconds between retargeting (prevent rapid switching)

/**
 * Update bot AI - targets nearest food and handles retargeting when stuck
 * Also handles sprinting decisions
 * @param {Object} snake - The snake object (must be a bot)
 * @param {Map} foodMap - Map of food items
 * @param {Array} allSnakes - Array of all snakes for threat detection
 */
function updateBotAI(snake, foodMap, allSnakes) {
  if (!snake || !snake.alive || !snake.segments || !snake.segments.length || !foodMap || foodMap.size === 0) {
    if (snake) snake.sprinting = false;
    return;
  }

  const head = snake.segments[0];
  if (!head) {
    snake.sprinting = false;
    return;
  }
  let currentTime = Date.now() / 1000; // Current time in seconds

  // Initialize bot properties if they don't exist
  if (snake.targetFoodId === undefined) {
    snake.targetFoodId = null;
    snake.stuckStartTime = null;
    snake.initialCloseDistance = Infinity;
    snake.closestFoodDistance = Infinity;
    snake.targetFoodHistory = []; // Track recent target food IDs to avoid immediate retargeting
    snake.lastTargetTime = null;
    snake.positionHistory = []; // Track recent positions for spiral detection
    snake.lastAngle = null;
    snake.cumulativeAngleChange = 0;
    snake.lastRetargetTime = 0; // Track when we last retargeted
    snake.lastTargetPosition = null; // Track position of current target food
  }

  // Check if currently targeted food still exists
  let targetFood = null;
  if (snake.targetFoodId) {
    targetFood = foodMap.get(snake.targetFoodId);
        if (!targetFood) {
          // Target food was eaten or removed, reset
          snake.targetFoodId = null;
          snake.stuckStartTime = null;
          snake.initialCloseDistance = Infinity;
          snake.closestFoodDistance = Infinity;
          snake.cumulativeAngleChange = 0;
          snake.positionHistory = [];
        }
  }

  // If no target, find nearest food
  if (!targetFood) {
    let nearestFood = null;
    let nearestDist2 = Infinity;

    for (const [fid, food] of foodMap) {
      const d2 = dist2(head.x, head.y, food.x, food.y);
      if (d2 < nearestDist2) {
        nearestDist2 = d2;
        nearestFood = food;
        snake.targetFoodId = fid;
      }
    }

    if (nearestFood) {
      targetFood = nearestFood;
      // targetFoodId was already set in the loop above
      snake.stuckStartTime = null;
      snake.initialCloseDistance = Infinity;
      snake.closestFoodDistance = Math.sqrt(nearestDist2);
      snake.cumulativeAngleChange = 0;
      snake.positionHistory = [];
    } else {
      // No food available
      snake.sprinting = false;
      return;
    }
  }

  // Calculate distance to target food
  const currentDist2 = dist2(head.x, head.y, targetFood.x, targetFood.y);
  const currentDist = Math.sqrt(currentDist2);

  // Track position history for spiral detection
  snake.positionHistory.push({ x: head.x, y: head.y, time: currentTime });
  // Keep only recent positions
  while (snake.positionHistory.length > POSITION_HISTORY_SIZE) {
    snake.positionHistory.shift();
  }

  // Track angle changes to detect spinning
  if (snake.lastAngle !== null) {
    let angleDiff = snake.targetAngle - snake.lastAngle;
    // Wrap angle difference to [-pi, pi]
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    snake.cumulativeAngleChange += Math.abs(angleDiff);
    
    // Reset cumulative angle change if we've been going straight (low angle changes)
    if (Math.abs(angleDiff) < 0.05) {
      snake.cumulativeAngleChange *= 0.7; // More aggressive decay
    }
  } else {
    snake.lastAngle = snake.targetAngle;
  }
  snake.lastAngle = snake.targetAngle;
  
  // Store target food position for distance tracking
  if (targetFood) {
    snake.lastTargetPosition = { x: targetFood.x, y: targetFood.y };
  }

  // Check if we're in close proximity
  const isClose = currentDist < CLOSE_PROXIMITY_DISTANCE;

  // Start or continue tracking if close, OR if we've been targeting this food for a while
  const hasBeenTargeting = snake.stuckStartTime !== null;
  const timeSinceStartTracking = hasBeenTargeting ? currentTime - snake.stuckStartTime : 0;
  const timeSinceLastRetarget = currentTime - snake.lastRetargetTime;

  // Always track when we have a target (not just when close)
  if (targetFood) {
    // Check if we're making progress
    if (snake.stuckStartTime === null) {
      // Just started tracking, initialize
      snake.stuckStartTime = currentTime;
      snake.initialCloseDistance = currentDist;
      snake.closestFoodDistance = currentDist;
    } else {
      // Update closest distance reached while trying to get food
      if (currentDist < snake.closestFoodDistance) {
        snake.closestFoodDistance = currentDist;
      }

      // Check for spiral detection: excessive cumulative angle change
      const isSpinning = snake.cumulativeAngleChange > STUCK_ANGLE_CHANGE_THRESHOLD;
      
      // Check if stuck: been tracking for too long AND (haven't made progress OR spinning)
      const stuckDuration = currentTime - snake.stuckStartTime;
      const progressMade = snake.initialCloseDistance - snake.closestFoodDistance;
      const isStuck = (stuckDuration > STUCK_TIME_THRESHOLD && progressMade < MIN_PROGRESS_DISTANCE) || isSpinning;

      if (isStuck) {
        // Add current target to history (avoid retargeting immediately)
        if (snake.targetFoodHistory.indexOf(snake.targetFoodId) === -1) {
          snake.targetFoodHistory.push(snake.targetFoodId);
          // Keep only recent history
          if (snake.targetFoodHistory.length > 5) {
            snake.targetFoodHistory.shift();
          }
        }

        // Retarget: find a different food (excluding current target and recently failed targets)
        // Prefer food that's in a different direction to break the spiral
        let newTargetFood = null;
        let newTargetFoodId = null;
        let newNearestDist2 = Infinity;
        
        // Calculate angle to current target for comparison
        const currentTargetAngle = Math.atan2(targetFood.y - head.y, targetFood.x - head.x);
        
        // If we have a last target position, calculate distance from it
        let minDistanceFromLastTarget = 0;
        if (snake.lastTargetPosition) {
          minDistanceFromLastTarget = Math.hypot(
            snake.lastTargetPosition.x - head.x,
            snake.lastTargetPosition.y - head.y
          );
        }

        for (const [fid, food] of foodMap) {
          // Skip current target and recently failed targets
          if (fid === snake.targetFoodId || snake.targetFoodHistory.indexOf(fid) !== -1) continue;
          
          // Ensure it's far enough from last target position
          if (snake.lastTargetPosition) {
            const distFromLastTarget = Math.hypot(
              food.x - snake.lastTargetPosition.x,
              food.y - snake.lastTargetPosition.y
            );
            if (distFromLastTarget < MIN_TARGET_DISTANCE) continue; // Too close to last target
          }
          
          const d2 = dist2(head.x, head.y, food.x, food.y);
          
          // Calculate angle to this food
          const foodAngle = Math.atan2(food.y - head.y, food.x - head.x);
          let angleDiff = Math.abs(foodAngle - currentTargetAngle);
          // Wrap to [0, pi]
          angleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);
          
          // Prefer food that's in a different direction (angle difference > 45 degrees)
          // Apply a bonus (reduce effective distance) for food in different directions
          const angleBonus = angleDiff > Math.PI / 4 ? 0.8 : 1.0; // Prefer different direction (20% bonus)
          const adjustedDist2 = d2 / (angleBonus * angleBonus); // Square the bonus since we're comparing distances squared
          
          if (adjustedDist2 < newNearestDist2) {
            newNearestDist2 = adjustedDist2;
            newTargetFood = food;
            newTargetFoodId = fid;
          }
        }

        // If we found a new target, switch to it
        if (newTargetFood && newTargetFoodId) {
          const newTargetDist = Math.sqrt(newNearestDist2);
          targetFood = newTargetFood;
          snake.targetFoodId = newTargetFoodId;
          snake.stuckStartTime = null;
          snake.initialCloseDistance = newTargetDist; // Distance to new target
          snake.closestFoodDistance = newTargetDist;
          snake.cumulativeAngleChange = 0; // Reset angle tracking
          snake.positionHistory = []; // Reset position history
          snake.lastRetargetTime = currentTime; // Record retarget time
          snake.lastAngle = null; // Reset angle tracking completely
          snake.lastTargetPosition = { x: newTargetFood.x, y: newTargetFood.y }; // Store new target position
        } else {
          // No other food available - add current target to history and try to find ANY other food
          // This is more aggressive - if we can't find a good alternative, we'll at least try a different one
          if (snake.targetFoodHistory.indexOf(snake.targetFoodId) === -1) {
            snake.targetFoodHistory.push(snake.targetFoodId);
            if (snake.targetFoodHistory.length > 3) {
              snake.targetFoodHistory.shift();
            }
          }
          
          // Try again with relaxed constraints (any food except current)
          for (const [fid, food] of foodMap) {
            if (fid === snake.targetFoodId) continue;
            
            const d2 = dist2(head.x, head.y, food.x, food.y);
            if (d2 < newNearestDist2) {
              newNearestDist2 = d2;
              newTargetFood = food;
              newTargetFoodId = fid;
            }
          }
          
          if (newTargetFood && newTargetFoodId) {
            targetFood = newTargetFood;
            snake.targetFoodId = newTargetFoodId;
            snake.stuckStartTime = null;
            snake.initialCloseDistance = Math.sqrt(newNearestDist2);
            snake.closestFoodDistance = Math.sqrt(newNearestDist2);
            snake.cumulativeAngleChange = 0;
            snake.positionHistory = [];
            snake.lastRetargetTime = currentTime;
            snake.lastAngle = null;
          } else {
            // Still no alternative - reset tracking but keep trying
            snake.stuckStartTime = currentTime;
            snake.initialCloseDistance = currentDist;
            snake.closestFoodDistance = currentDist;
            snake.cumulativeAngleChange *= 0.3; // More aggressive reduction
          }
        }
      }
    }
  }

  // Calculate angle to target food (ensure targetFood exists)
  if (!targetFood) {
    snake.sprinting = false;
    return; // No target food available
  }

  const dx = targetFood.x - head.x;
  const dy = targetFood.y - head.y;
  const targetAngle = Math.atan2(dy, dx);

  // Update snake's target angle
  snake.targetAngle = targetAngle;

  // Sprint decision logic
  // Check for nearby threats (other snakes)
  let nearestThreatDistance = Infinity;
  for (const other of allSnakes) {
    if (other === snake || !other.alive) continue;
    const otherHead = other.segments[0];
    if (!otherHead) continue;
    
    const threatDist2 = dist2(head.x, head.y, otherHead.x, otherHead.y);
    const threatDist = Math.sqrt(threatDist2);
    
    // Consider it a threat if it's larger or similar size and close
    if (threatDist < nearestThreatDistance && other.score >= snake.score * 0.8) {
      nearestThreatDistance = threatDist;
    }
  }

  // Decide whether to sprint
  const shouldSprintForFood = currentDist < SPRINT_CHASE_DISTANCE && 
                               snake.score >= MIN_SPRINT_SCORE &&
                               snake.score > SNAKE.startLen;
  
  const shouldSprintToEscape = nearestThreatDistance < SPRINT_ESCAPE_DISTANCE &&
                                snake.score >= MIN_SPRINT_SCORE &&
                                snake.score > SNAKE.startLen;

  // Sprint if chasing food or escaping threat (but prioritize escape)
  if (shouldSprintToEscape) {
    snake.sprinting = true;
  } else if (shouldSprintForFood && !shouldSprintToEscape) {
    // Only sprint for food if not currently escaping and have enough score buffer
    snake.sprinting = true;
  } else {
    // Stop sprinting if conditions aren't met
    snake.sprinting = false;
  }
}

/**
 * Check if a snake is a bot (has bot properties or no socket)
 * @param {Object} snake - The snake object
 * @returns {boolean} - True if snake is a bot
 */
function isBot(snake) {
  return snake.isBot === true || snake.targetFoodId !== undefined;
}

module.exports = {
  updateBotAI,
  isBot,
};

