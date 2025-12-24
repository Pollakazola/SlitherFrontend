// UI management
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");
const joinBtn = document.getElementById("join");
const respawnBtn = document.getElementById("respawn");
const feedBtn = document.getElementById("feed");
const deathMsgEl = document.getElementById("deathMsg");

let onJoin = null;
let onRespawn = null;
let onFeed = null;

joinBtn.onclick = () => {
  if (onJoin) onJoin(nameEl.value);
};

respawnBtn.onclick = () => {
  if (onRespawn) onRespawn();
};

feedBtn.onclick = () => {
  if (onFeed) onFeed();
};

function setStatus(text) {
  statusEl.textContent = text;
}

function showDeathMessage(show) {
  deathMsgEl.style.display = show ? 'block' : 'none';
}

function setHandlers(joinHandler, respawnHandler, feedHandler) {
  onJoin = joinHandler;
  onRespawn = respawnHandler;
  onFeed = feedHandler;
}

export { setStatus, showDeathMessage, setHandlers };
