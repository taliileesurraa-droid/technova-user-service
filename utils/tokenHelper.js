const jwt = require('jsonwebtoken');

/**
 * Extract user information from JWT token
 * @param {string} token - JWT token
 * @returns {Object} User information from token
 */
function extractUserFromToken(token) {
  try {
    if (!token) return null;
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET || 'secret');
    
    return {
      id: decoded.id,
      type: decoded.type,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
      // Extract user details if available in token
      name: decoded.name || null,
      phone: decoded.phone || null,
      email: decoded.email || null,
      vehicle_info: decoded.vehicle_info || null, // For drivers
    };
  } catch (error) {
    console.error('Error extracting user from token:', error.message);
    return null;
  }
}

/**
 * Get user info from request (token or external service)
 * @param {Object} req - Express request object
 * @param {string} userId - User ID to fetch info for
 * @param {string} userType - Type of user (passenger, driver, admin)
 * @returns {Object} User information
 */
async function getUserInfo(req, userId = null, userType = null) {
  const targetUserId = userId || req.user?.id;
  const targetUserType = userType || req.user?.type;
  
  if (!targetUserId || !targetUserType) return null;

  // First try to get info from token
  const tokenInfo = extractUserFromToken(req.headers.authorization);
  if (tokenInfo && tokenInfo.id === targetUserId) {
    return {
      id: tokenInfo.id,
      name: tokenInfo.name,
      phone: tokenInfo.phone,
      email: tokenInfo.email,
      vehicle_info: tokenInfo.vehicle_info,
      type: tokenInfo.type
    };
  }

  // Fallback to external service
  try {
    const { getPassengerById, getDriverById, getAdminById } = require('./userService');
    const authHeader = req.headers && req.headers.authorization ? 
      { headers: { Authorization: req.headers.authorization } } : {};

    let userInfo = null;
    switch (targetUserType) {
      case 'passenger':
        userInfo = await getPassengerById(targetUserId, authHeader);
        break;
      case 'driver':
        userInfo = await getDriverById(targetUserId, authHeader);
        break;
      case 'admin':
        userInfo = await getAdminById(targetUserId, authHeader);
        break;
    }

    return userInfo ? {
      id: targetUserId,
      name: userInfo.name || null,
      phone: userInfo.phone || null,
      email: userInfo.email || null,
      vehicle_info: userInfo.vehicle_info || null,
      type: targetUserType
    } : null;
  } catch (error) {
    console.error('Error fetching user info:', error.message);
    return null;
  }
}

/**
 * Populate user fields in an object
 * @param {Object} obj - Object to populate
 * @param {Object} userInfo - User information
 * @param {string} prefix - Prefix for field names (e.g., 'passenger_', 'driver_')
 * @returns {Object} Object with populated user fields
 */
function populateUserFields(obj, userInfo, prefix = '') {
  if (!userInfo) return obj;
  
  return {
    ...obj,
    [`${prefix}name`]: userInfo.name || null,
    [`${prefix}phone`]: userInfo.phone || null,
    [`${prefix}email`]: userInfo.email || null,
    ...(userInfo.vehicle_info && { [`${prefix}vehicle_info`]: userInfo.vehicle_info })
  };
}

module.exports = {
  extractUserFromToken,
  getUserInfo,
  populateUserFields
};