/**
 * Extracts the human-readable address string from a location field
 * that could be either an old string format or a new structured object format.
 *
 * @param {string|object} location - The location value from the Job document.
 * @returns {string} The formatted address string.
 */
export const getLocationString = (location) => {
  if (!location) return '';
  if (typeof location === 'object' && location !== null) {
    return location.address || '';
  }
  return String(location);
};

/**
 * Extracts coordinates and generates a Google Maps Directions URL if available.
 *
 * @param {string|object} location - The location value from the Job document.
 * @returns {string|null} The Google Maps URL or null if no coordinates exist.
 */
export const getDirectionsUrl = (location) => {
  if (
    typeof location === 'object' &&
    location !== null &&
    typeof location.latitude === 'number' &&
    typeof location.longitude === 'number'
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
  }
  return null;
};
