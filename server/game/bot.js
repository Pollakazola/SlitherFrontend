// Bot AI logic for automatic food targeting
const { dist2 } = require('./world');
const { SNAKE, FOOD, DT } = require('./constants');

// Constants for bot behavior
const CLOSE_PROXIMITY_DISTANCE = 200; // Distance considered "close" to food (in world units)
const STUCK_TIME_THRESHOLD = 2.0; // Seconds before retargeting
const MIN_PROGRESS_DISTANCE = 30; // Minimum distance improvement needed to avoid retargeting (in world units)
const SPRINT_CHASE_DISTANCE = 400; // Distance to food to consider sprinting
const SPRINT_ESCAPE_DISTANCE = 300; // Distance to enemy snake to consider sprinting to escape
const MIN_SPRINT_SCORE = 30; // Minimum score needed before bots will sprint (need some buffer)

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
      snake.stuckStartTime = null;
      snake.initialCloseDistance = Infinity;
      snake.closestFoodDistance = Math.sqrt(nearestDist2);
    } else {
      // No food available
      snake.sprinting = false;
      return;
    }
  }

  // Calculate distance to target food
  const currentDist2 = dist2(head.x, head.y, targetFood.x, targetFood.y);
  const currentDist = Math.sqrt(currentDist2);

  // Check if we're in close proximity
  const isClose = currentDist < CLOSE_PROXIMITY_DISTANCE;

  if (isClose) {
    // Check if we're making progress
    if (snake.stuckStartTime === null) {
      // Just entered close proximity, start tracking
      snake.stuckStartTime = currentTime;
      snake.initialCloseDistance = currentDist;
      snake.closestFoodDistance = currentDist;
    } else {
      // Update closest distance reached while trying to get food
      if (currentDist < snake.closestFoodDistance) {
        snake.closestFoodDistance = currentDist;
      }

      // We've been close for a while, check if we're stuck
      const stuckDuration = currentTime - snake.stuckStartTime;
      const progressMade = snake.initialCloseDistance - snake.closestFoodDistance;

      // Check if stuck: been close for too long AND haven't made sufficient progress
      if (stuckDuration > STUCK_TIME_THRESHOLD && progressMade < MIN_PROGRESS_DISTANCE) {
        // Retarget: find a different food (excluding current target)
        let newTargetFood = null;
        let newNearestDist2 = Infinity;

        for (const [fid, food] of foodMap) {
          if (fid === snake.targetFoodId) continue; // Skip current target
          
          const d2 = dist2(head.x, head.y, food.x, food.y);
          if (d2 < newNearestDist2) {
            newNearestDist2 = d2;
            newTargetFood = food;
            snake.targetFoodId = fid;
          }
        }

        if (newTargetFood) {
          // Successfully retargeted
          targetFood = newTargetFood;
          snake.stuckStartTime = null;
          snake.initialCloseDistance = Infinity;
          snake.closestFoodDistance = Math.sqrt(newNearestDist2);
        } else {
          // No other food available, keep current target but reset stuck timer
          snake.stuckStartTime = currentTime;
          snake.initialCloseDistance = currentDist;
          snake.closestFoodDistance = currentDist;
        }
      }
    }
  } else {
    // Not in close proximity, reset stuck tracking
    snake.stuckStartTime = null;
    snake.initialCloseDistance = Infinity;
    snake.closestFoodDistance = Infinity;
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

