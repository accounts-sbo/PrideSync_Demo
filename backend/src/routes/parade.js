const express = require('express');
const boatState = require('../services/boatState');
const routeMapper = require('../services/routeMapper');
const logger = require('../services/logger');

const router = express.Router();

/**
 * GET /api/parade/status
 * Get overall parade status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const stats = boatState.getParadeStats();
    const routeInfo = routeMapper.getRouteInfo();

    res.json({
      success: true,
      parade: {
        status: stats.activeBoats > 0 ? 'active' : 'waiting',
        statistics: stats,
        route: {
          totalDistance: routeInfo.totalDistance,
          totalPoints: routeInfo.totalPoints,
          maxToleranceMeters: routeInfo.maxToleranceMeters
        },
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching parade status:', error);
    res.status(500).json({
      error: 'Failed to fetch parade status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parade/route
 * Get parade route information and waypoints
 */
router.get('/route', async (req, res) => {
  try {
    const routeInfo = routeMapper.getRouteInfo();

    res.json({
      success: true,
      route: routeInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching parade route:', error);
    res.status(500).json({
      error: 'Failed to fetch parade route',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parade/leaderboard
 * Get boat leaderboard based on progress
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const boats = boatState.getAllBoatStates();
    
    // Sort boats by route progress (descending)
    const leaderboard = boats
      .filter(boat => boat.position.routeProgress > 0)
      .sort((a, b) => b.position.routeProgress - a.position.routeProgress)
      .map((boat, index) => ({
        rank: index + 1,
        id: boat.id,
        name: boat.name,
        status: boat.status,
        routeProgress: boat.position.routeProgress,
        routeDistance: boat.position.routeDistance,
        speed: boat.position.speed,
        lastUpdate: boat.lastUpdate
      }));

    res.json({
      success: true,
      count: leaderboard.length,
      leaderboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching parade leaderboard:', error);
    res.status(500).json({
      error: 'Failed to fetch parade leaderboard',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parade/incidents
 * Get all current incidents across the parade
 */
router.get('/incidents', async (req, res) => {
  try {
    const boats = boatState.getAllBoatStates();
    const allIncidents = [];

    boats.forEach(boat => {
      if (boat.incidents && boat.incidents.length > 0) {
        // Get recent incidents (last 24 hours)
        const recentIncidents = boat.incidents.filter(incident => {
          const incidentTime = new Date(incident.timestamp);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return incidentTime > dayAgo;
        });

        recentIncidents.forEach(incident => {
          allIncidents.push({
            ...incident,
            boatId: boat.id,
            boatName: boat.name,
            boatStatus: boat.status
          });
        });
      }
    });

    // Sort by timestamp (most recent first)
    allIncidents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      count: allIncidents.length,
      incidents: allIncidents,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching parade incidents:', error);
    res.status(500).json({
      error: 'Failed to fetch parade incidents',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parade/summary
 * Get comprehensive parade summary for dashboard
 */
router.get('/summary', async (req, res) => {
  try {
    const stats = boatState.getParadeStats();
    const boats = boatState.getAllBoatStates();
    const routeInfo = routeMapper.getRouteInfo();

    // Calculate additional metrics
    const boatsInCorridor = boats.filter(b => b.corridor.inCorridor).length;
    const boatsWithIncidents = boats.filter(b => b.incidents.length > 0).length;
    const averageSpeed = boats.length > 0 
      ? boats.reduce((sum, b) => sum + (b.position.speed || 0), 0) / boats.length 
      : 0;

    // Get leading and trailing boats
    const sortedBoats = boats
      .filter(b => b.position.routeProgress > 0)
      .sort((a, b) => b.position.routeProgress - a.position.routeProgress);

    const leadingBoat = sortedBoats[0] || null;
    const trailingBoat = sortedBoats[sortedBoats.length - 1] || null;

    res.json({
      success: true,
      summary: {
        overview: {
          status: stats.activeBoats > 0 ? 'active' : 'waiting',
          totalBoats: stats.totalBoats,
          activeBoats: stats.activeBoats,
          finishedBoats: stats.finishedBoats,
          emergencyBoats: stats.emergencyBoats
        },
        progress: {
          averageProgress: Math.round(stats.averageProgress * 100) / 100,
          averageSpeed: Math.round(averageSpeed * 100) / 100,
          leadingBoat: leadingBoat ? {
            id: leadingBoat.id,
            name: leadingBoat.name,
            progress: leadingBoat.position.routeProgress
          } : null,
          trailingBoat: trailingBoat ? {
            id: trailingBoat.id,
            name: trailingBoat.name,
            progress: trailingBoat.position.routeProgress
          } : null
        },
        safety: {
          boatsInCorridor,
          boatsOutOfCorridor: stats.totalBoats - boatsInCorridor,
          boatsWithIncidents,
          corridorCompliance: stats.totalBoats > 0 
            ? Math.round((boatsInCorridor / stats.totalBoats) * 100) 
            : 100
        },
        route: {
          totalDistance: routeInfo.totalDistance,
          estimatedDuration: '2 hours', // Static for now
          weatherConditions: 'Good' // TODO: Integrate weather API
        },
        lastUpdate: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching parade summary:', error);
    res.status(500).json({
      error: 'Failed to fetch parade summary',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
