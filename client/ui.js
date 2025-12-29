// UI management
const landingPageEl = document.getElementById("landingPage");
const landingNameEl = document.getElementById("landingName");
const startGameBtn = document.getElementById("startGame");

let onJoin = null;
let onRespawn = null;
let onFeed = null;
let onStartGame = null;

startGameBtn.onclick = () => {
  if (onStartGame) {
    const name = landingNameEl.value.trim() || "Guest";
    const selectedSprite = document.querySelector('input[name="spriteType"]:checked');
    const skinId = selectedSprite ? selectedSprite.value : "default";
    onStartGame(name, skinId);
  }
};

// Allow Enter key to start game
landingNameEl.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    startGameBtn.click();
  }
});

// Add visual feedback for sprite selection
function updateSpriteSelection() {
  const spriteOptions = document.querySelectorAll('input[name="spriteType"]');
  spriteOptions.forEach(option => {
    const optionDiv = option.closest('.spriteOption');
    if (option.checked) {
      optionDiv.classList.add('selected');
    } else {
      optionDiv.classList.remove('selected');
    }
  });
}

// Initialize selection on page load
document.addEventListener("DOMContentLoaded", () => {
  updateSpriteSelection();
  const spriteOptions = document.querySelectorAll('input[name="spriteType"]');
  spriteOptions.forEach(option => {
    option.addEventListener("change", updateSpriteSelection);
  });
});

function setStatus(text) {
  // Status display removed - no longer needed
}

function showDeathMessage(show) {
  // Death message removed - no longer needed
}

function showLandingPage(show) {
  if (show) {
    landingPageEl.classList.remove("hidden");
  } else {
    landingPageEl.classList.add("hidden");
  }
}

function setHandlers(joinHandler, respawnHandler, feedHandler, startGameHandler) {
  onJoin = joinHandler;
  onRespawn = respawnHandler;
  onFeed = feedHandler;
  onStartGame = startGameHandler;
}

export { setStatus, showDeathMessage, showLandingPage, setHandlers };
