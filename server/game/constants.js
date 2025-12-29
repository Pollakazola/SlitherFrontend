// Game constants
module.exports = {
  PORT: process.env.PORT || 8080,
  TICK_HZ: 20,
  DT: 1 / 20,

  WORLD: {
    w: 6000,
    h: 6000,
    centerX: 3000, // Center of circular barrier
    centerY: 3000,
    barrierRadius: 2800, // Radius of playable area (circular barrier)
  },

  SNAKE: {
    startLen: 20,
    segSpacing: 0.1, baseSpeed: 220, // units/sec (minimal spacing for 70% overlap)
    turnRate: 8.0,  // radians/sec
    radius: 16,
    baseWidth: 18, // base width for rendering (lineWidth)
    widthGrowthPerFood: 0.5, // width increase per food consumed
    maxWidth: 100000, // maximum width
    growthPerFood: 6, // segments
    selfCollisionSkip: 8, // skip first N segments for self-collision
    skipBaseCost: 3, // Base number of tail removal skips needed per segment growth (3x harder)
    skipMultiplier: 1.25, // Exponential multiplier for skip cost
    skipScoreStep: 10, // Score step for exponential skip cost calculation
    skipsPerFood: 1, // Number of skip credits added per food eaten
    sprintCostPerSecond: 2, // Food cost per second while sprinting (directly affects length)
    sprintFoodDropDelay: 2, // Seconds to accumulate before dropping food
    sprintFoodDropDistance: 50, // Distance to drop food behind head (to prevent immediate pickup)
  },

  FOOD: {
    count: 700,
    radius: 6,
  },

  NET: {
    inputRateLimit: 20, // max input messages per second per client
    snapshotDownsample: 2, // downsample segments for bandwidth
  },

  BOT: {
    count: 10, // Number of bots to spawn
    minCount: 8, // Minimum number of bots to maintain
  },
};
