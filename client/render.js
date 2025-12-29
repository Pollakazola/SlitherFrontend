// Rendering and interpolation
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

let state = {
  meId: null,
  world: { 
    w: 6000, 
    h: 6000,
    centerX: 3000,
    centerY: 3000,
    barrierRadius: 2800
  },
  snakes: new Map(),
  food: [],
  cam: { x: 0, y: 0, zoom: 1.0 },
};

// Interpolation state
let prevSnapshot = null;
let currentSnapshot = null;
let snapshotTime = 0;
const SNAPSHOT_INTERVAL = 50; // 20 Hz = 50ms

function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", resize);
resize();

function updateState(newState) {
  state = { ...state, ...newState };
}

function updateSnapshot(snapshot) {
  const now = performance.now();
  prevSnapshot = currentSnapshot;
  currentSnapshot = snapshot;
  snapshotTime = now;
}

function getInterpolatedState() {
  if (!currentSnapshot) return state;

  const now = performance.now();
  const elapsed = now - snapshotTime;
  const alpha = Math.min(1, elapsed / SNAPSHOT_INTERVAL);

  // If we only have one snapshot, use it directly
  if (!prevSnapshot || alpha >= 1) {
    const snakes = new Map();
    for (const [id, sn] of (currentSnapshot.snakes || [])) {
      snakes.set(id, { ...sn, width: sn.width || 18 });
    }
    return {
      ...state,
      snakes,
      food: currentSnapshot.food || [],
    };
  }

  // Interpolate between snapshots
  const interpolated = {
    ...state,
    snakes: new Map(),
    food: currentSnapshot.food || [],
  };

  // Interpolate snake positions
  const prevSnakes = new Map(prevSnapshot.snakes || []);
  const currSnakes = new Map(currentSnapshot.snakes || []);

  for (const [id, currSn] of currSnakes) {
    const prevSn = prevSnakes.get(id);
    if (!prevSn || !prevSn.segs || !currSn.segs) {
      interpolated.snakes.set(id, currSn);
      continue;
    }

    // Interpolate segments
    const interpSegs = [];
    const maxLen = Math.max(prevSn.segs.length, currSn.segs.length);
    for (let i = 0; i < maxLen; i++) {
      const prevSeg = prevSn.segs[i] || prevSn.segs[prevSn.segs.length - 1];
      const currSeg = currSn.segs[i] || currSn.segs[currSn.segs.length - 1];
      const x = prevSeg[0] + (currSeg[0] - prevSeg[0]) * alpha;
      const y = prevSeg[1] + (currSeg[1] - prevSeg[1]) * alpha;
      interpSegs.push([x, y]);
    }

    // Interpolate width if available
    const prevWidth = prevSn.width || currSn.width || 18;
    const currWidth = currSn.width || 18;
    const interpWidth = prevWidth + (currWidth - prevWidth) * alpha;

    interpolated.snakes.set(id, {
      ...currSn,
      segs: interpSegs,
      width: interpWidth,
    });
  }

  return interpolated;
}

function worldToScreen(wx, wy, cam) {
  const x = (wx - cam.x) * cam.zoom + innerWidth / 2;
  const y = (wy - cam.y) * cam.zoom + innerHeight / 2;
  return [x, y];
}

function getMe(interpState) {
  return interpState.snakes.get(interpState.meId);
}

function drawBarrier(cam) {
  // Draw red circular barrier
  const world = state.world;
  const centerX = world.centerX || 3000;
  const centerY = world.centerY || 3000;
  const barrierRadius = world.barrierRadius || 2800;
  
  const [cx, cy] = worldToScreen(centerX, centerY, cam);
  const screenRadius = barrierRadius * cam.zoom;
  
  // Always draw the barrier if we have valid world data
  ctx.save();
  
  // Draw outer glow effect for better visibility (drawn first, behind main line)
  ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; // Semi-transparent red
  ctx.lineWidth = Math.max(10, 10 * cam.zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw main barrier outline (thick red stroke)
  ctx.strokeStyle = "#ff0000"; // Bright red
  ctx.lineWidth = Math.max(5, 5 * cam.zoom); // Thicker line, scales with zoom
  ctx.beginPath();
  ctx.arc(cx, cy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw inner highlight for extra visibility
  ctx.strokeStyle = "rgba(255, 150, 150, 0.7)"; // Lighter red
  ctx.lineWidth = Math.max(2, 2 * cam.zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}

function drawGrid(cam) {
  const step = 200;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;

  const halfW = (innerWidth / 2) / cam.zoom;
  const halfH = (innerHeight / 2) / cam.zoom;
  const minX = cam.x - halfW;
  const maxX = cam.x + halfW;
  const minY = cam.y - halfH;
  const maxY = cam.y + halfH;

  const gx0 = Math.floor(minX / step) * step;
  const gy0 = Math.floor(minY / step) * step;

  for (let x = gx0; x < maxX; x += step) {
    const [sx1, sy1] = worldToScreen(x, minY, cam);
    const [sx2, sy2] = worldToScreen(x, maxY, cam);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }

  for (let y = gy0; y < maxY; y += step) {
    const [sx1, sy1] = worldToScreen(minX, y, cam);
    const [sx2, sy2] = worldToScreen(maxX, y, cam);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFood(food, cam) {
  ctx.save();
  
  for (const foodItem of food) {
    // Food format: [x, y, id, size, hue, isExploding, explosionTime] or [x, y, id, size] (legacy) or [x, y, id] (old legacy)
    const x = foodItem[0];
    const y = foodItem[1];
    const size = foodItem.length > 3 ? (foodItem[3] || 4) : 4; // Default to 4 if size not provided (legacy support)
    const hue = foodItem.length > 4 && foodItem[4] !== null && foodItem[4] !== undefined ? foodItem[4] : null;
    const isExploding = foodItem.length > 5 ? (foodItem[5] || false) : false;
    const explosionTime = foodItem.length > 6 ? (foodItem[6] || 0) : 0;
    
    const [sx, sy] = worldToScreen(x, y, cam);
    const screenSize = size * cam.zoom;
    
    // Special effects for explosion food
    if (isExploding && explosionTime < 1.0) {
      // Draw glow effect
      const glowSize = screenSize * (1.5 + Math.sin(explosionTime * 20) * 0.3);
      const alpha = (1 - explosionTime) * 0.6; // Fade out over 1 second
      
      // Outer glow
      const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowSize);
      if (hue !== null) {
        // Use snake's color for explosion food
        gradient.addColorStop(0, `hsla(${hue}, 90%, 70%, ${alpha})`);
        gradient.addColorStop(0.5, `hsla(${hue}, 80%, 60%, ${alpha * 0.5})`);
        gradient.addColorStop(1, `hsla(${hue}, 70%, 50%, 0)`);
      } else {
        gradient.addColorStop(0, `rgba(255, 200, 100, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(255, 150, 50, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 100, 0, 0)`);
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(sx, sy, glowSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner bright core
      ctx.fillStyle = hue !== null 
        ? `hsla(${hue}, 100%, 80%, ${alpha * 0.9})`
        : `rgba(255, 255, 200, ${alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(sx, sy, screenSize * 0.6, 0, Math.PI * 2);
      ctx.fill();
      
      // Main food circle with pulsing effect
      const pulse = 1 + Math.sin(explosionTime * 15) * 0.15;
      ctx.fillStyle = hue !== null 
        ? `hsl(${hue}, 95%, 65%)`
        : `rgba(120, 200, 255, 0.9)`;
      ctx.beginPath();
      ctx.arc(sx, sy, screenSize * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Sparkle effect (small particles around food)
      if (explosionTime < 0.3) {
        ctx.strokeStyle = hue !== null 
          ? `hsla(${hue}, 100%, 90%, ${(0.3 - explosionTime) / 0.3})`
          : `rgba(255, 255, 255, ${(0.3 - explosionTime) / 0.3})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const sparkleAngle = (Math.PI * 2 / 4) * i + explosionTime * 10;
          const sparkleDist = screenSize * 1.5;
          const sparkleX = sx + Math.cos(sparkleAngle) * sparkleDist;
          const sparkleY = sy + Math.sin(sparkleAngle) * sparkleDist;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sparkleX, sparkleY);
          ctx.stroke();
          
          // Sparkle point
          ctx.fillStyle = hue !== null 
            ? `hsla(${hue}, 100%, 90%, ${(0.3 - explosionTime) / 0.3})`
            : `rgba(255, 255, 255, ${(0.3 - explosionTime) / 0.3})`;
          ctx.beginPath();
          ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Normal food rendering
      ctx.fillStyle = hue !== null 
        ? `hsl(${hue}, 85%, 65%)` // Use snake color if available
        : "rgba(120, 200, 255, 0.9)"; // Default blue
      ctx.beginPath();
      ctx.arc(sx, sy, screenSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

function drawSnake(sn, cam) {
  const segs = sn.segs;
  if (!segs || !segs.length) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Use dynamic width based on score/food consumption
  const snakeWidth = (sn.width || 18) * cam.zoom;

  // Body
  ctx.beginPath();
  for (let i = 0; i < segs.length; i++) {
    const [x, y] = segs[i];
    const [sx, sy] = worldToScreen(x, y, cam);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.strokeStyle = `hsl(${sn.hue}, 85%, 60%)`;
  ctx.lineWidth = snakeWidth;
  ctx.stroke();

  // Head dot (proportional to width)
  const [hx, hy] = segs[0];
  const [hsx, hsy] = worldToScreen(hx, hy, cam);
  const headRadius = (snakeWidth / 2) * 0.55; // Head slightly smaller than body width
  ctx.beginPath();
  ctx.arc(hsx, hsy, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${sn.hue}, 95%, 65%)`;
  ctx.fill();

  // Name
  ctx.font = `${14 * cam.zoom}px system-ui, Arial`;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillText(sn.name, hsx + 14 * cam.zoom, hsy - 14 * cam.zoom);

  ctx.restore();
}

function drawLeaderboard(snakes) {
  const arr = [...snakes.values()]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8);

  ctx.save();
  ctx.font = "28px system-ui, Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText("Leaderboard", innerWidth - 280, 52);
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < arr.length; i++) {
    const sn = arr[i];
    const y = 96 + i * 36;
    const x = innerWidth - 360;
    
    // Draw head sprite (small circle with snake's color)
    const headRadius = 10; // Fixed size for leaderboard
    const headX = x - 20; // Position before the text
    ctx.beginPath();
    ctx.arc(headX, y - 4, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${sn.hue || 200}, 95%, 65%)`;
    ctx.fill();
    
    // Draw text with head sprite offset
    ctx.fillText(
      `${i + 1}. ${sn.name} (${Math.floor(sn.score || 0)})`,
      x,
      y
    );
  }
  ctx.restore();
}

function render() {
  const interpState = getInterpolatedState();
  const me = getMe(interpState);

  // Update camera to follow player
  if (me && me.segs && me.segs.length) {
    const [hx, hy] = me.segs[0];
    state.cam.x += (hx - state.cam.x) * 0.12;
    state.cam.y += (hy - state.cam.y) * 0.12;
  }

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  drawGrid(state.cam);
  drawFood(interpState.food, state.cam);

  for (const sn of interpState.snakes.values()) {
    drawSnake(sn, state.cam);
  }

  drawBarrier(state.cam); // Draw barrier on top so it's always visible
  drawLeaderboard(interpState.snakes);
}

function setZoom(zoom) {
  state.cam.zoom = zoom;
}

export { updateState, updateSnapshot, render, getMe, worldToScreen, getInterpolatedState, setZoom };
