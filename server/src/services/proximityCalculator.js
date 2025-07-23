class ProximityCalculator {
  // Bereken afstand tussen twee punten (Haversine formule)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI/180);
  }

  // Vind dichtstbijzijnde boot
  findNearestBoat(userLat, userLon, boats) {
    if (!boats || boats.length === 0) {
      return null;
    }

    let nearestBoat = null;
    let minDistance = Infinity;

    boats.forEach(boat => {
      const distance = this.calculateDistance(userLat, userLon, boat.lat, boat.lon);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestBoat = {
          ...boat,
          distance: Math.round(distance * 1000) / 1000 // Round to 3 decimals
        };
      }
    });

    return nearestBoat;
  }

  // Vind alle boten binnen bepaalde radius
  findBoatsInRadius(userLat, userLon, boats, radiusKm = 1.0) {
    return boats
      .map(boat => ({
        ...boat,
        distance: this.calculateDistance(userLat, userLon, boat.lat, boat.lon)
      }))
      .filter(boat => boat.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }
}

module.exports = new ProximityCalculator();

