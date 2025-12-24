// Build script to inject environment variables into index.html
// This runs during Render's build process
const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Get WS_BACKEND_URL from environment variable (set in Render dashboard)
const wsBackendUrl = process.env.WS_BACKEND_URL;

if (wsBackendUrl) {
  // Replace the placeholder script with actual backend URL
  const configScript = `
  <script>
    // Backend URL from environment variable (injected during build)
    window.WS_BACKEND_URL = '${wsBackendUrl}';
  </script>`;
  
  // Find the existing config script tag and replace it
  // Match the script tag that contains the WS_BACKEND_URL configuration
  const scriptPattern = /<script>[\s\S]*?\/\/ Configure WebSocket[\s\S]*?<\/script>/;
  if (scriptPattern.test(html)) {
    html = html.replace(scriptPattern, configScript);
  } else {
    // If no script tag exists, add it before the main.js script
    html = html.replace(
      '<script type="module" src="main.js"></script>',
      configScript + '\n  <script type="module" src="main.js"></script>'
    );
  }
  
  console.log(`✓ Injected WS_BACKEND_URL: ${wsBackendUrl}`);
} else {
  console.log('⚠ WS_BACKEND_URL not set, using default localhost configuration');
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('✓ Build complete');

