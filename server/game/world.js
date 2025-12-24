// World utilities
const { WORLD } = require('./constants');

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function isInsideBarrier(x, y) {
  const dx = x - WORLD.centerX;
  const dy = y - WORLD.centerY;
  const dist2 = dx * dx + dy * dy;
  return dist2 <= (WORLD.barrierRadius * WORLD.barrierRadius);
}

function wrapPos(p) {
  // Keep position within circular barrier bounds
  const dx = p.x - WORLD.centerX;
  const dy = p.y - WORLD.centerY;
  const dist = Math.hypot(dx, dy);
  
  if (dist > WORLD.barrierRadius) {
    // Clamp to barrier edge
    const angle = Math.atan2(dy, dx);
    p.x = WORLD.centerX + Math.cos(angle) * WORLD.barrierRadius;
    p.y = WORLD.centerY + Math.sin(angle) * WORLD.barrierRadius;
  }
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

module.exports = {
  wrapPos,
  dist2,
  rand,
  uid,
  isInsideBarrier,
};
