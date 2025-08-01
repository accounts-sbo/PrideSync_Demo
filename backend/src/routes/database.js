const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const database = require('../models/database');

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

module.exports = router;
