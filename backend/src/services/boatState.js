const logger = require('./logger');
const database = require('../models/database');

// In-memory storage for boat states (with database persistence)
const boatStates = new Map();
const boatHistory = new Map();

/**
 * Boat state structure
 */
const createBoatState = (boatId) => ({
  id: boatId,
  name: `Pride Boat ${boatId}`,
  status: 'active', // active, waiting, finished, emergency
  position: {
    latitude: null,
    longitude: null,
    timestamp: null,
    routeDistance: 0,
    routeProgress: 0,
    speed: 0,
    heading: 0
  },
  corridor: {
    inCorridor: true,
    lastWarning: null,
    warningCount: 0
  },
  incidents: [],
  lastUpdate: new Date(),
  created: new Date()
});

/**
 * Update boat position with new GPS data
 * @param {number} boatId - Boat identifier
 * @param {Object} positionData - New position data
 * @returns {Promise<Object>} Updated boat state
 */
async function updateBoatPosition(boatId, positionData) {
  try {
    // Get or create boat state
    let boat = boatStates.get(boatId);
    if (!boat) {
      boat = createBoatState(boatId);
      boatStates.set(boatId, boat);
      logger.info(`Created new boat state for boat ${boatId}`);
    }

    // Store previous position for speed calculation
    const previousPosition = { ...boat.position };
    
    // Update position
    boat.position = {
      ...boat.position,
      ...positionData,
      lastUpdate: new Date()
    };

    // Calculate speed if we have previous position
    if (previousPosition.timestamp && previousPosition.routeDistance) {
      const timeDiff = (new Date(positionData.timestamp) - new Date(previousPosition.timestamp)) / 1000; // seconds
      const distanceDiff = positionData.routeDistance - previousPosition.routeDistance; // meters
      
      if (timeDiff > 0) {
        boat.position.speed = Math.round((distanceDiff / timeDiff) * 3.6 * 100) / 100; // km/h
      }
    }

    // Update boat status based on progress
    if (boat.position.routeProgress >= 100) {
      boat.status = 'finished';
    } else if (boat.position.routeProgress > 0) {
      boat.status = 'active';
    }

    boat.lastUpdate = new Date();

    // Store position history
    addToHistory(boatId, {
      ...positionData,
      speed: boat.position.speed
    });

    // Save to database
    try {
      await database.saveBoatPosition(boatId, {
        ...positionData,
        speed: boat.position.speed
      });

      // Cache boat state
      await database.cacheSet(`boat:${boatId}`, boat, 300);
    } catch (error) {
      logger.error(`Error saving boat position to database for boat ${boatId}:`, error);
      // Continue without database - in-memory state is still updated
    }

    logger.debug(`Updated position for boat ${boatId}`, {
      boatId,
      progress: boat.position.routeProgress,
      speed: boat.position.speed
    });

    return boat;

  } catch (error) {
    logger.error(`Error updating boat position for boat ${boatId}:`, error);
    throw error;
  }
}

/**
 * Add position to boat history
 * @param {number} boatId - Boat identifier
 * @param {Object} positionData - Position data to store
 */
function addToHistory(boatId, positionData) {
  if (!boatHistory.has(boatId)) {
    boatHistory.set(boatId, []);
  }
  
  const history = boatHistory.get(boatId);
  history.push({
    ...positionData,
    recorded: new Date()
  });

  // Keep only last 100 positions to prevent memory issues
  if (history.length > 100) {
    history.shift();
  }
}

/**
 * Check if boat is within designated corridor
 * @param {number} boatId - Boat identifier
 * @returns {Promise<Object>} Corridor status
 */
async function checkCorridor(boatId) {
  const boat = boatStates.get(boatId);
  if (!boat) {
    return { inCorridor: false, error: 'Boat not found' };
  }

  // Simple corridor check based on distance from route
  const maxDistanceFromRoute = 50; // meters
  const distanceFromRoute = boat.position.distanceFromRoute || 0;
  
  const inCorridor = distanceFromRoute <= maxDistanceFromRoute;
  
  if (!inCorridor && boat.corridor.inCorridor) {
    // Boat just left corridor
    boat.corridor.lastWarning = new Date();
    boat.corridor.warningCount++;
    
    logger.warn(`Boat ${boatId} left designated corridor`, {
      boatId,
      distanceFromRoute,
      warningCount: boat.corridor.warningCount
    });
  }

  boat.corridor.inCorridor = inCorridor;

  return {
    inCorridor,
    distanceFromRoute,
    outOfCorridor: !inCorridor,
    warningCount: boat.corridor.warningCount,
    lastWarning: boat.corridor.lastWarning
  };
}

/**
 * Check for potential incidents based on boat behavior
 * @param {number} boatId - Boat identifier
 * @param {Object} currentData - Current boat data
 * @returns {Promise<Object>} Incident status
 */
async function checkForIncidents(boatId, currentData) {
  const boat = boatStates.get(boatId);
  if (!boat) {
    return { hasIncident: false, error: 'Boat not found' };
  }

  const incidents = [];

  // Check for stopped boat (speed too low for too long)
  if (boat.position.speed < 0.5 && boat.status === 'active') {
    incidents.push({
      type: 'stopped',
      severity: 'warning',
      message: 'Boat appears to be stopped',
      timestamp: new Date()
    });
  }

  // Check for boat going backwards
  if (boat.position.speed < -1) {
    incidents.push({
      type: 'reverse',
      severity: 'warning', 
      message: 'Boat is moving backwards',
      timestamp: new Date()
    });
  }

  // Check for excessive speed
  if (boat.position.speed > 10) {
    incidents.push({
      type: 'speeding',
      severity: 'warning',
      message: 'Boat speed exceeds safe limits',
      timestamp: new Date()
    });
  }

  return {
    hasIncident: incidents.length > 0,
    incidents,
    count: incidents.length
  };
}

/**
 * Update boat status
 * @param {number} boatId - Boat identifier
 * @param {string} status - New status
 * @param {Object} metadata - Additional status metadata
 * @returns {Promise<Object>} Updated boat state
 */
async function updateBoatStatus(boatId, status, metadata = {}) {
  const boat = boatStates.get(boatId);
  if (!boat) {
    throw new Error(`Boat ${boatId} not found`);
  }

  boat.status = status;
  boat.lastUpdate = new Date();

  if (metadata.message) {
    const incident = {
      type: status,
      message: metadata.message,
      severity: metadata.severity || 'info',
      timestamp: metadata.timestamp || new Date()
    };

    boat.incidents.push(incident);

    // Save incident to database
    try {
      await database.saveBoatIncident(boatId, incident);
    } catch (error) {
      logger.error(`Error saving incident to database for boat ${boatId}:`, error);
    }
  }

  // Update cache
  try {
    await database.cacheSet(`boat:${boatId}`, boat, 300);
  } catch (error) {
    logger.error(`Error updating cache for boat ${boatId}:`, error);
  }

  logger.info(`Updated status for boat ${boatId}`, {
    boatId,
    status,
    metadata
  });

  return boat;
}

/**
 * Trigger incident for boat
 * @param {number} boatId - Boat identifier
 * @param {Object} incidentData - Incident data
 * @returns {Promise<void>}
 */
async function triggerIncident(boatId, incidentData) {
  const boat = boatStates.get(boatId);
  if (!boat) {
    throw new Error(`Boat ${boatId} not found`);
  }

  // Add incidents to boat state
  boat.incidents.push(...incidentData.incidents);

  // Update status if severe incident
  const severeIncidents = incidentData.incidents.filter(i => i.severity === 'critical');
  if (severeIncidents.length > 0) {
    boat.status = 'emergency';
  }

  logger.warn(`Incident triggered for boat ${boatId}`, {
    boatId,
    incidentCount: incidentData.incidents.length,
    incidents: incidentData.incidents
  });
}

/**
 * Get boat state by ID
 * @param {number} boatId - Boat identifier
 * @returns {Object|null} Boat state or null if not found
 */
function getBoatState(boatId) {
  return boatStates.get(boatId) || null;
}

/**
 * Get all boat states
 * @returns {Array} Array of all boat states
 */
function getAllBoatStates() {
  return Array.from(boatStates.values());
}

/**
 * Get boat position history
 * @param {number} boatId - Boat identifier
 * @param {number} limit - Maximum number of history entries
 * @returns {Array} Position history
 */
function getBoatHistory(boatId, limit = 50) {
  const history = boatHistory.get(boatId) || [];
  return history.slice(-limit);
}

/**
 * Get parade statistics
 * @returns {Object} Parade statistics
 */
function getParadeStats() {
  const boats = getAllBoatStates();
  
  return {
    totalBoats: boats.length,
    activeBoats: boats.filter(b => b.status === 'active').length,
    finishedBoats: boats.filter(b => b.status === 'finished').length,
    emergencyBoats: boats.filter(b => b.status === 'emergency').length,
    averageProgress: boats.length > 0 
      ? boats.reduce((sum, b) => sum + b.position.routeProgress, 0) / boats.length 
      : 0,
    lastUpdate: new Date()
  };
}

/**
 * Clear all boat states (for testing)
 */
function clearAllBoatStates() {
  boatStates.clear();
  boatHistory.clear();
  logger.debug('Cleared all boat states');
}

module.exports = {
  updateBoatPosition,
  checkCorridor,
  checkForIncidents,
  updateBoatStatus,
  triggerIncident,
  getBoatState,
  getAllBoatStates,
  getBoatHistory,
  getParadeStats,
  clearAllBoatStates
};
