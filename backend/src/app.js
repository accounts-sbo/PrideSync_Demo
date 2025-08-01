const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./services/logger');
const database = require('./models/database');
const webhookRoutes = require('./routes/webhooks');
const boatRoutes = require('./routes/boats');
const paradeRoutes = require('./routes/parade');
const cmsRoutes = require('./routes/cms');
const deviceManagementRoutes = require('./routes/device-management');
const votingRoutes = require('./routes/voting');
const databaseRoutes = require('./routes/database');

const app = express();
const PORT = process.env.PORT || 3001;

// Force restart to pick up new DATABASE_URL and GPS extraction code

// Trust proxy for Railway deployment (fixes X-Forwarded-For warnings)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://*.vercel.app',
    'https://pride-sync-demo-frontend-2025.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

// Rate limiting with proper trust proxy configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP',
  trustProxy: true, // Explicitly trust proxy for rate limiting
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Ultra-simple health check for Railway deployment - no database calls
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Alternative health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Detailed health check with database status
app.get('/health/detailed', async (req, res) => {
  try {
    // Check database connectivity
    let dbStatus = 'unknown';
    try {
      await database.testConnection();
      dbStatus = 'connected';
    } catch (dbError) {
      dbStatus = 'disconnected';
    }

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
      uptime: process.uptime()
    });
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API Routes
app.use('/api/webhooks', webhookRoutes);
app.use('/api/boats', boatRoutes);
app.use('/api/parade', paradeRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/device-management', deviceManagementRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/database', databaseRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server immediately without any database initialization
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚂 PrideSync Backend running on port ${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://0.0.0.0:${PORT}/health`);
  logger.info(`📡 Webhook endpoints:`);
  logger.info(`   - KPN GPS: http://0.0.0.0:${PORT}/api/webhooks/kpn-gps`);
  logger.info(`   - Tracker GPS: http://0.0.0.0:${PORT}/api/webhooks/tracker-gps`);
  logger.info(`🔧 Device Management CMS: http://0.0.0.0:${PORT}/api/device-management/cms`);

  // Initialize database in background after server is running
  setTimeout(() => {
    database.initializeDatabase()
      .then(() => {
        logger.info('✅ Database initialization completed');
      })
      .catch((error) => {
        logger.error('❌ Database initialization failed:', error);
        logger.warn('⚠️ Server running without database connections');
      });
  }, 100); // Small delay to ensure server is fully started
});

module.exports = app;
