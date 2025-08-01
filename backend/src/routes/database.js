const express = require('express');
const multer = require('multer');
const router = express.Router();
const logger = require('../services/logger');
const database = require('../models/database');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.mimetype === 'text/plain' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * Get Database Statistics
 * GET /api/database/stats
 * 
 * Returns overview of all tables with row counts and column info
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('📊 Fetching database statistics');
    
    const stats = await database.getDatabaseStats();
    
    logger.info(`✅ Database stats retrieved: ${stats.total_tables} tables, ${stats.total_rows} total rows`);
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get database stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database statistics',
      message: error.message
    });
  }
});

/**
 * Get Table Data
 * GET /api/database/table/:tableName
 * 
 * Returns data from a specific table with optional limit
 */
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    logger.info(`📋 Fetching data from table: ${tableName} (limit: ${limit})`);
    
    const tableData = await database.getTableData(tableName, limit);
    
    logger.info(`✅ Table data retrieved: ${tableData.rows.length} rows from ${tableName}`);
    
    res.json({
      success: true,
      data: tableData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`❌ Failed to get table data for ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve table data',
      message: error.message,
      table: req.params.tableName
    });
  }
});

/**
 * Get GPS Clean Data
 * GET /api/database/gps-clean
 * 
 * Returns cleaned GPS data with only essential fields
 */
router.get('/gps-clean', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    logger.info(`🗺️ Fetching clean GPS data (limit: ${limit})`);
    
    const gpsData = await database.getCleanGPSData(limit);
    
    logger.info(`✅ Clean GPS data retrieved: ${gpsData.length} positions`);
    
    res.json({
      success: true,
      data: gpsData,
      count: gpsData.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to get clean GPS data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve clean GPS data',
      message: error.message
    });
  }
});

/**
 * Create GPS Clean Table
 * POST /api/database/create-gps-clean
 * 
 * Creates the gps_clean table and migrates existing data
 */
router.post('/create-gps-clean', async (req, res) => {
  try {
    logger.info('🔧 Creating GPS clean table and migrating data');
    
    const result = await database.createGPSCleanTable();
    
    logger.info(`✅ GPS clean table created and ${result.migrated_rows} rows migrated`);
    
    res.json({
      success: true,
      message: 'GPS clean table created successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Failed to create GPS clean table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create GPS clean table',
      message: error.message
    });
  }
});

/**
 * Initialize Database Tables
 * POST /api/database/init-tables
 *
 * Manually initialize database tables
 */
router.post('/init-tables', async (req, res) => {
  try {
    logger.info('🔧 Manually initializing database tables');

    // Call the database initialization
    await database.initializeDatabase();

    res.json({
      success: true,
      message: 'Database tables initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error initializing database tables:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Force Create Tables
 * POST /api/database/force-create-tables
 *
 * Force create all database tables with direct SQL
 */
router.post('/force-create-tables', async (req, res) => {
  try {
    logger.info('🔧 Force creating database tables with direct SQL');

    const result = await database.forceCreateTables();

    res.json({
      success: true,
      message: 'Database tables force created successfully',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error force creating database tables:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Upload Boats CSV
 * POST /api/database/upload-boats-csv
 *
 * Upload CSV file with boats and tracker mappings
 */
router.post('/upload-boats-csv', upload.single('csv'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CSV file uploaded',
        timestamp: new Date().toISOString()
      });
    }

    logger.info('📁 Processing CSV upload:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Parse CSV content
    const csvContent = req.file.buffer.toString('utf-8');
    const result = await database.processBoatsCSV(csvContent);

    logger.info('✅ CSV processed successfully:', result);

    res.json({
      success: true,
      message: `Successfully processed ${result.total_rows} boats from CSV`,
      stats: {
        pride_boats: result.pride_boats_created,
        kpn_trackers: result.kpn_trackers_created,
        mappings: result.mappings_created
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error processing CSV upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process CSV file',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Extract GPS Data from Historical Webhooks
 * POST /api/database/extract-historical-gps
 *
 * Analyze existing webhook logs and extract GPS data retroactively
 */
router.post('/extract-historical-gps', async (req, res) => {
  try {
    logger.info('🔍 Starting historical GPS data extraction from webhook logs');

    const result = await database.extractHistoricalGPSData();

    logger.info('✅ Historical GPS extraction completed:', result);

    res.json({
      success: true,
      message: 'Historical GPS data extracted successfully',
      stats: {
        webhooks_processed: result.webhooks_processed,
        gps_positions_extracted: result.gps_positions_extracted,
        devices_found: result.devices_found
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error extracting historical GPS data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to extract historical GPS data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
