const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRouter = require('./routes/api.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) {
        const duration = Date.now() - start;
        console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });
}

// Mount REST API Engine
app.use('/api', apiRouter);

// Serve Static Assets (frontend UI)
app.use(express.static(path.join(__dirname)));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Fallback for SPA routing to index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  next();
});


// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`  iOSArsenal API & UI Server running`);
    console.log(`  UI URL:       http://localhost:${PORT}`);
    console.log(`  API Base:     http://localhost:${PORT}/api`);
    console.log(`  API Stats:    http://localhost:${PORT}/api/stats`);
    console.log(`  API Playbooks: http://localhost:${PORT}/api/playbooks`);
    console.log(`==================================================\n`);
  });
}

module.exports = app;
