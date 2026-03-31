// Simple health check endpoint for Render
const http = require('http');

const PORT = process.env.PORT || 3000;

// Create a simple health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'stealthvault-keeper',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start health check server
server.listen(PORT, () => {
  console.log(`🏥 Health check server running on port ${PORT}`);
});

// Export for use in main keeper
module.exports = server;