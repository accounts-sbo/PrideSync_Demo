const logger = require('./logger');

/**
 * Amsterdam Pride Parade Route (2025)
 * Polyline coordinates for the official canal route
 * Based on the traditional Amsterdam canal parade route
 */
const PARADE_ROUTE = [
  // Start: Westerdok
  { lat: 52.3851, lng: 4.8947, distance: 0 },
  // Prinsengracht (south)
  { lat: 52.3836, lng: 4.8842, distance: 850 },
  { lat: 52.3758, lng: 4.8835, distance: 1720 },
  // Amstel river
  { lat: 52.3677, lng: 4.8951, distance: 2580 },
  { lat: 52.3648, lng: 4.8978, distance: 2920 },
  // Zwanenburgwal
  { lat: 52.3668, lng: 4.9015, distance: 3250 },
  // Oudeschans
  { lat: 52.3712, lng: 4.9058, distance: 3780 },
  // Finish: Oosterdok
  { lat: 52.3742, lng: 4.9089, distance: 4200 }
];

const TOTAL_ROUTE_DISTANCE = 4200; // meters
const MAX_DISTANCE_FROM_ROUTE = 100; // meters tolerance

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point  
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

/**
 * Calculate bearing between two GPS coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

/**
 * Find the closest point on the parade route to given GPS coordinates
 * @param {number} latitude - GPS latitude
 * @param {number} longitude - GPS longitude
 * @returns {Object|null} Closest route point with distance info
 */
function findClosestRoutePoint(latitude, longitude) {
  let closestPoint = null;
  let minDistance = Infinity;
  let closestIndex = -1;

  for (let i = 0; i < PARADE_ROUTE.length; i++) {
    const routePoint = PARADE_ROUTE[i];
    const distance = calculateDistance(latitude, longitude, routePoint.lat, routePoint.lng);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = routePoint;
      closestIndex = i;
    }
  }

  // Check if boat is within acceptable distance from route
  if (minDistance > MAX_DISTANCE_FROM_ROUTE) {
    logger.warn(`GPS position too far from parade route`, {
      coordinates: [latitude, longitude],
      distanceFromRoute: minDistance,
      maxAllowed: MAX_DISTANCE_FROM_ROUTE
    });
    return null;
  }

  return {
    ...closestPoint,
    distanceFromRoute: minDistance,
    routeIndex: closestIndex
  };
}

/**
 * Interpolate position between two route points for more accurate distance calculation
 * @param {number} latitude - GPS latitude
 * @param {number} longitude - GPS longitude
 * @param {Object} closestPoint - Closest route point
 * @returns {Object} Interpolated position data
 */
function interpolatePosition(latitude, longitude, closestPoint) {
  const routeIndex = closestPoint.routeIndex;
  
  // If at start or end of route, use exact point
  if (routeIndex === 0 || routeIndex === PARADE_ROUTE.length - 1) {
    return {
      distanceMeters: closestPoint.distance,
      progressPercent: (closestPoint.distance / TOTAL_ROUTE_DISTANCE) * 100
    };
  }

  // Interpolate between current and next route point
  const currentPoint = PARADE_ROUTE[routeIndex];
  const nextPoint = PARADE_ROUTE[routeIndex + 1];
  
  const distanceToNext = calculateDistance(
    latitude, longitude, 
    nextPoint.lat, nextPoint.lng
  );
  
  const segmentLength = nextPoint.distance - currentPoint.distance;
  const segmentProgress = Math.max(0, Math.min(1, 
    1 - (distanceToNext / calculateDistance(
      currentPoint.lat, currentPoint.lng,
      nextPoint.lat, nextPoint.lng
    ))
  ));
  
  const interpolatedDistance = currentPoint.distance + (segmentLength * segmentProgress);
  const progressPercent = (interpolatedDistance / TOTAL_ROUTE_DISTANCE) * 100;

  return {
    distanceMeters: Math.round(interpolatedDistance),
    progressPercent: Math.round(progressPercent * 100) / 100
  };
}

/**
 * Map GPS coordinates to parade route position
 * @param {Object} gpsData - GPS data object
 * @param {number} gpsData.latitude - GPS latitude
 * @param {number} gpsData.longitude - GPS longitude
 * @param {Date} gpsData.timestamp - GPS timestamp
 * @returns {Promise<Object|null>} Route position data or null if invalid
 */
async function mapToRoute(gpsData) {
  try {
    const { latitude, longitude, timestamp } = gpsData;
    
    // Find closest point on parade route
    const closestPoint = findClosestRoutePoint(latitude, longitude);
    if (!closestPoint) {
      return null;
    }

    // Calculate interpolated position
    const position = interpolatePosition(latitude, longitude, closestPoint);
    
    // Calculate heading (bearing to next route point)
    let heading = 0;
    if (closestPoint.routeIndex < PARADE_ROUTE.length - 1) {
      const nextPoint = PARADE_ROUTE[closestPoint.routeIndex + 1];
      heading = calculateBearing(latitude, longitude, nextPoint.lat, nextPoint.lng);
    }

    // Estimate speed (would need previous position for accurate calculation)
    const estimatedSpeed = 0; // TODO: Implement speed calculation with position history

    logger.debug('GPS position mapped to route', {
      originalCoords: [latitude, longitude],
      routeProgress: position.progressPercent,
      distanceFromRoute: closestPoint.distanceFromRoute
    });

    return {
      ...position,
      heading: Math.round(heading),
      estimatedSpeed,
      distanceFromRoute: Math.round(closestPoint.distanceFromRoute),
      routeSegment: closestPoint.routeIndex,
      timestamp: timestamp,
      isValid: true
    };

  } catch (error) {
    logger.error('Error mapping GPS to route:', error);
    return null;
  }
}

/**
 * Get parade route information
 * @returns {Object} Route metadata
 */
function getRouteInfo() {
  return {
    totalDistance: TOTAL_ROUTE_DISTANCE,
    totalPoints: PARADE_ROUTE.length,
    maxToleranceMeters: MAX_DISTANCE_FROM_ROUTE,
    route: PARADE_ROUTE.map(point => ({
      lat: point.lat,
      lng: point.lng,
      distance: point.distance,
      progressPercent: (point.distance / TOTAL_ROUTE_DISTANCE) * 100
    }))
  };
}

module.exports = {
  mapToRoute,
  getRouteInfo,
  calculateDistance,
  calculateBearing
};
