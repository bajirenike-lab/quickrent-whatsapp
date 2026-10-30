/**
 * Geospatial distance calculation using Haversine formula
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place (e.g. 1.4 km)
}

/**
 * Filter and sort properties by proximity to user coordinates
 */
function findPropertiesNear(properties, userLat, userLng, maxDistanceKm = 25, categoryFilter = null) {
  const matches = [];

  for (const prop of properties) {
    if (!prop.isAvailable) continue;
    if (categoryFilter && categoryFilter !== 'all' && prop.category !== categoryFilter) continue;

    const dist = haversineDistanceKm(userLat, userLng, prop.latitude, prop.longitude);
    if (dist <= maxDistanceKm) {
      matches.push({
        ...prop,
        distanceKm: dist
      });
    }
  }

  // Sort closest first
  matches.sort((a, b) => a.distanceKm - b.distanceKm);
  return matches;
}

module.exports = {
  haversineDistanceKm,
  findPropertiesNear
};
