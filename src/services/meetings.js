const crypto = require('crypto');

/**
 * Generates an instant, free Jitsi Meet room link for live virtual property tours.
 * Zero login or API key required. Works natively in mobile browsers with camera/mic.
 */
function createVirtualInspectionRoom(bookingRef, propertyTitle = '') {
  const cleanTitle = (propertyTitle || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 15);
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const roomName = `QuickRent-${cleanTitle || 'Tour'}-${randomSuffix}`;
  return `https://meet.jit.si/${roomName}`;
}

module.exports = {
  createVirtualInspectionRoom
};
