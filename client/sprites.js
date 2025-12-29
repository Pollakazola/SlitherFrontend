// Sprite loader for head and body sprites
const spriteCache = new Map();

// Available skins
const AVAILABLE_SKINS = [
  { id: "default" },
  { id: "snake1" }, // head1 and body1 assets
  { id: "snake2" }, // head2 and body2 assets
  // Add more skins here as you create them
];

// Load head and body sprites for a skin
function loadSkinSprites(skinId) {
  return new Promise((resolve, reject) => {
    // Check cache
    if (spriteCache.has(skinId)) {
      resolve(spriteCache.get(skinId));
      return;
    }

    const headImg = new Image();
    const bodyImg = new Image();
    let headLoaded = false;
    let bodyLoaded = false;
    let hasError = false;

    function checkComplete() {
      if (headLoaded && bodyLoaded) {
        const sprites = { head: headImg, body: bodyImg };
        spriteCache.set(skinId, sprites);
        resolve(sprites);
      } else if (hasError && !headLoaded && !bodyLoaded) {
        // Both failed, try default
        if (skinId !== "default") {
          loadSkinSprites("default").then(resolve).catch(reject);
        } else {
          reject(new Error(`Failed to load default skin`));
        }
      }
    }

    headImg.onload = () => {
      headLoaded = true;
      checkComplete();
    };
    headImg.onerror = () => {
      hasError = true;
      checkComplete();
    };

    bodyImg.onload = () => {
      bodyLoaded = true;
      checkComplete();
    };
    bodyImg.onerror = () => {
      hasError = true;
      checkComplete();
    };

    // Load images
    headImg.src = `assets/skins/${skinId}/head.png`;
    bodyImg.src = `assets/skins/${skinId}/body.png`;
  });
}

// Preload all skins
export async function preloadAllSkins() {
  const loadPromises = AVAILABLE_SKINS.map(skin => loadSkinSprites(skin.id));
  try {
    await Promise.all(loadPromises);
    console.log("All skins preloaded");
  } catch (error) {
    console.error("Error preloading skins:", error);
  }
}

// Get sprites from cache
export function getSkinSprites(skinId) {
  return spriteCache.get(skinId || "default") || spriteCache.get("default");
}

// Ensure sprites are loaded (async)
export async function ensureSkinLoaded(skinId) {
  const cached = spriteCache.get(skinId || "default");
  if (cached) {
    return cached;
  }
  return await loadSkinSprites(skinId || "default");
}

