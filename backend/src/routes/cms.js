const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const logger = require('../services/logger');
const database = require('../models/database');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Validation schemas
const boatSchema = Joi.object({
  boat_number: Joi.number().integer().min(1).max(999).required(),
  name: Joi.string().min(1).max(255).required(),
  imei: Joi.string().length(15).pattern(/^\d+$/).optional(),
  description: Joi.string().max(1000).optional(),
  captain_name: Joi.string().max(255).optional(),
  captain_phone: Joi.string().max(20).optional(),
  status: Joi.string().valid('waiting', 'active', 'finished', 'emergency').optional()
});

const updateBoatSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  imei: Joi.string().length(15).pattern(/^\d+$/).optional(),
  description: Joi.string().max(1000).optional(),
  captain_name: Joi.string().max(255).optional(),
  captain_phone: Joi.string().max(20).optional(),
  status: Joi.string().valid('waiting', 'active', 'finished', 'emergency').optional()
});

/**
 * GET /api/cms/boats
 * Get all boats for CMS management
 */
router.get('/boats', async (req, res) => {
  try {
    const boats = await database.getAllBoats();
    
    res.json({
      success: true,
      count: boats.length,
      boats: boats
    });
  } catch (error) {
    logger.error('Error fetching boats for CMS:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to fetch boats'
    });
  }
});

/**
 * GET /api/cms/boats/:identifier
 * Get specific boat by number or IMEI
 */
router.get('/boats/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const boat = await database.getBoat(identifier);
    
    if (!boat) {
      return res.status(404).json({
        success: false,
        error: 'Boat not found',
        identifier: identifier
      });
    }
    
    res.json({
      success: true,
      boat: boat
    });
  } catch (error) {
    logger.error('Error fetching boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/cms/boats
 * Create new boat
 */
router.post('/boats', async (req, res) => {
  try {
    // Validate input
    const { error, value } = boatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details[0].message,
        received: req.body
      });
    }

    // Check if boat number already exists
    const existingBoat = await database.getBoat(value.boat_number);
    if (existingBoat) {
      return res.status(409).json({
        success: false,
        error: 'Boat number already exists',
        boat_number: value.boat_number
      });
    }

    // Check if IMEI already exists (if provided)
    if (value.imei) {
      const existingImei = await database.getBoat(value.imei);
      if (existingImei) {
        return res.status(409).json({
          success: false,
          error: 'IMEI already exists',
          imei: value.imei
        });
      }
    }

    // Create boat
    const newBoat = await database.createBoat(value);
    
    logger.info('New boat created via CMS:', {
      boat_number: newBoat.boat_number,
      name: newBoat.name,
      imei: newBoat.imei
    });

    res.status(201).json({
      success: true,
      message: 'Boat created successfully',
      boat: newBoat
    });

  } catch (error) {
    logger.error('Error creating boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create boat'
    });
  }
});

/**
 * PUT /api/cms/boats/:boatNumber
 * Update existing boat
 */
router.put('/boats/:boatNumber', async (req, res) => {
  try {
    const boatNumber = parseInt(req.params.boatNumber);
    
    if (isNaN(boatNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid boat number'
      });
    }

    // Validate input
    const { error, value } = updateBoatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details[0].message
      });
    }

    // Check if boat exists
    const existingBoat = await database.getBoat(boatNumber);
    if (!existingBoat) {
      return res.status(404).json({
        success: false,
        error: 'Boat not found',
        boat_number: boatNumber
      });
    }

    // Check IMEI uniqueness if updating IMEI
    if (value.imei && value.imei !== existingBoat.imei) {
      const imeiCheck = await database.getBoat(value.imei);
      if (imeiCheck && imeiCheck.boat_number !== boatNumber) {
        return res.status(409).json({
          success: false,
          error: 'IMEI already exists',
          imei: value.imei
        });
      }
    }

    // Update boat
    const updatedBoat = await database.updateBoat(boatNumber, value);
    
    logger.info('Boat updated via CMS:', {
      boat_number: boatNumber,
      changes: value
    });

    res.json({
      success: true,
      message: 'Boat updated successfully',
      boat: updatedBoat
    });

  } catch (error) {
    logger.error('Error updating boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/cms/boats/:boatNumber
 * Delete boat
 */
router.delete('/boats/:boatNumber', async (req, res) => {
  try {
    const boatNumber = parseInt(req.params.boatNumber);
    
    if (isNaN(boatNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid boat number'
      });
    }

    const deletedBoat = await database.deleteBoat(boatNumber);
    
    if (!deletedBoat) {
      return res.status(404).json({
        success: false,
        error: 'Boat not found',
        boat_number: boatNumber
      });
    }

    logger.info('Boat deleted via CMS:', {
      boat_number: boatNumber,
      name: deletedBoat.name
    });

    res.json({
      success: true,
      message: 'Boat deleted successfully',
      boat: deletedBoat
    });

  } catch (error) {
    logger.error('Error deleting boat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/cms/stats
 * Get CMS statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const boats = await database.getAllBoats();
    
    const stats = {
      total_boats: boats.length,
      by_status: {
        waiting: boats.filter(b => b.status === 'waiting').length,
        active: boats.filter(b => b.status === 'active').length,
        finished: boats.filter(b => b.status === 'finished').length,
        emergency: boats.filter(b => b.status === 'emergency').length
      },
      with_imei: boats.filter(b => b.imei).length,
      without_imei: boats.filter(b => !b.imei).length
    };

    res.json({
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching CMS stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/cms/import-boats
 * Import boats from CSV file
 */
router.post('/import-boats', upload.single('csvFile'), async (req, res) => {
  const fs = require('fs');

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CSV file uploaded'
      });
    }

    // Read and parse CSV file
    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');

    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'CSV file must have at least a header and one data row'
      });
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    // Validate required headers
    const requiredHeaders = ['Asset Type', 'Name', 'Asset Code', 'Device Type', 'Serial Number'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required headers: ${missingHeaders.join(', ')}`
      });
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // Process each boat
    for (let i = 1; i < lines.length; i++) {
      try {
        const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''));

        if (row.length !== headers.length) {
          skipped++;
          continue;
        }

        // Map row data to object
        const data = {};
        headers.forEach((header, index) => {
          data[header] = row[index] || '';
        });

        // Extract boat number from Name field
        const boatNumber = parseInt(data['Name']);
        if (isNaN(boatNumber)) {
          errors++;
          errorDetails.push(`Row ${i}: Invalid boat number in Name field: ${data['Name']}`);
          continue;
        }

        // Create boat object
        const boatData = {
          boat_number: boatNumber,
          name: `Pride Boat ${boatNumber}`,
          description: data['Description'] || `KPN Tracked Boat ${boatNumber}`,
          status: 'waiting',
          asset_code: data['Asset Code'],
          asset_type: data['Asset Type'] || 'Boat',
          device_type: data['Device Type'],
          serial_number: data['Serial Number'],
          enabled: data['Enabled'] === 'Enabled',
          current_status: data['Current Status']
        };

        // Try to create boat
        await database.createBoat(boatData);
        imported++;

      } catch (error) {
        errors++;
        errorDetails.push(`Row ${i}: ${error.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Import completed. Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`,
      imported,
      skipped,
      errors,
      errorDetails: errorDetails.slice(0, 10) // Limit error details
    });

  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    logger.error('Error importing boats from CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to import boats from CSV'
    });
  }
});

module.exports = router;
