// Network communication
// Configuration: Set window.WS_BACKEND_URL in index.html or it defaults to localhost
// For production on Render: Set WS_BACKEND_URL to your backend service URL (e.g., 'wss://your-backend.onrender.com')
// For local development: Leave undefined to use 'ws://localhost:8080'
const getWS_URL = () => {
  // Check if backend URL is explicitly configured
  if (window.WS_BACKEND_URL) {
    return window.WS_BACKEND_URL;
  }
  
  // Default to localhost for development
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.hostname}:8080`;
};

const WS_URL = getWS_URL();

let ws = null;
let onMessageCallback = null;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    if (onMessageCallback) onMessageCallback({ type: 'connected' });
  };

  ws.onclose = () => {
    if (onMessageCallback) onMessageCallback({ type: 'disconnected' });
  };

  ws.onerror = () => {
    if (onMessageCallback) onMessageCallback({ type: 'error' });
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (onMessageCallback) onMessageCallback({ type: 'message', data: msg });
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function setMessageHandler(callback) {
  onMessageCallback = callback;
}

export { connect, send, setMessageHandler, WS_URL };
