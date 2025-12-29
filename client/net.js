// Network communication
// Use WS_BACKEND_URL from build-time environment variable if available, otherwise use localhost
const WS_URL = window.WS_BACKEND_URL || `ws://${location.hostname}:8080`;

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
