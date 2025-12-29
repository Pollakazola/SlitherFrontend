// UI management
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");
const joinBtn = document.getElementById("join");
const respawnBtn = document.getElementById("respawn");
const feedBtn = document.getElementById("feed");
const deathMsgEl = document.getElementById("deathMsg");
const landingPageEl = document.getElementById("landingPage");
const landingNameEl = document.getElementById("landingName");
const startGameBtn = document.getElementById("startGame");

let onJoin = null;
let onRespawn = null;
let onFeed = null;
let onStartGame = null;

joinBtn.onclick = () => {
  if (onJoin) onJoin(nameEl.value);
};

respawnBtn.onclick = () => {
  if (onRespawn) onRespawn();
};

feedBtn.onclick = () => {
  if (onFeed) onFeed();
};

startGameBtn.onclick = () => {
  if (onStartGame) {
    const name = landingNameEl.value.trim() || "Guest";
    onStartGame(name);
  }
};

// Allow Enter key to start game
landingNameEl.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    startGameBtn.click();
  }
});

function setStatus(text) {
  statusEl.textContent = text;
}

function showDeathMessage(show) {
  deathMsgEl.style.display = show ? 'block' : 'none';
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
