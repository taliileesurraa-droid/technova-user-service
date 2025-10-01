const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { models } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

/**
 * Generate JWT access token for user
 * @param {Object} payload - User data to include in token
 * @returns {string} JWT access token
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

/**
 * Generate JWT token for user (legacy function)
 * @param {Object} payload - User data to include in token
 * @param {string} secret - Secret key for signing
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
function generateToken(payload, secret = JWT_SECRET, expiresIn = ACCESS_TOKEN_EXPIRES_IN) {
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret key for verification (optional)
 * @returns {Object} Decoded token payload
 */
function verifyToken(token, secret = JWT_SECRET) {
  return jwt.verify(token, secret);
}

/**
 * Socket.IO auth helper that extracts user info from a JWT and attaches to socket
 */
function socketAuth(socket, next) {
  try {
    let raw = socket.handshake.auth?.token
      || socket.handshake.query?.token
      || socket.handshake.headers?.authorization;
    if (!raw) return next();
    const token = String(raw)
      .replace(/^\s+|\s+$/g, '')
      .replace(/^(Bearer|JWT|Token)\s+/i, '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    // Prefer nested user/driver fields if present, then fall back to top-level claims
    const top = decoded || {};
    const userObj = (decoded && decoded.user) || {};
    const driverObj = (decoded && decoded.driver) || {};
    const src = { ...userObj, ...driverObj, ...top };
    const name = src.name || src.fullName || src.displayName;
    const phone = src.phone || src.phoneNumber || src.mobile;
    const email = src.email;
    const vehicleType = src.vehicleType;
    const carName = src.carName || src.carModel || src.vehicleName || src.carname || driverObj.carName || driverObj.carModel;
    const carModel = src.carModel || src.carName || src.vehicleName || src.carname || driverObj.carModel || driverObj.carName;
    const carPlate = src.carPlate || src.car_plate || src.carPlateNumber || src.plate || src.plateNumber || driverObj.carPlate;
    const carColor = src.carColor || src.color || driverObj.carColor;
    socket.user = {
      id: src.id ? String(src.id) : (decoded.id ? String(decoded.id) : undefined),
      type: src.type || decoded.type,
      name,
      phone,
      email,
      vehicleType,
      carName,
      carModel,
      carPlate,
      carColor
    };
    socket.authToken = `Bearer ${token}`;
    return next();
  } catch (e) {
    return next();
  }
}

function generateRandomTokenString(bytes = 48) {
  return crypto.randomBytes(bytes).toString('hex');
}

async function hashToken(token) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(token, salt);
}

async function compareHashedToken(token, hashed) {
  return bcrypt.compare(token, hashed);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function issueRefreshToken({ userType, userId, metadata }) {
  const rawToken = generateRandomTokenString(32);
  const hashedToken = await hashToken(rawToken);
  const expiresAt = addDays(new Date(), REFRESH_TOKEN_TTL_DAYS);
  const row = await models.RefreshToken.create({ userType, userId, hashedToken, expiresAt, metadata: metadata || null });
  return { token: rawToken, record: row };
}

async function rotateRefreshToken({ token, userType, userId }) {
  // Find active token
  const rows = await models.RefreshToken.findAll({ where: { userType, userId, revokedAt: null } });
  let current = null;
  for (const r of rows) {
    if (await compareHashedToken(token, r.hashedToken)) { current = r; break; }
  }
  if (!current) return null;
  if (new Date(current.expiresAt) < new Date()) return null;

  // Revoke current and issue new
  const { token: newRaw, record: newRec } = await issueRefreshToken({ userType, userId });
  current.revokedAt = new Date();
  current.replacedByTokenId = newRec.id;
  await current.save();
  return { newToken: newRaw, newRecord: newRec };
}

/**
 * Generate secure refresh token (random string)
 * @returns {string} Random refresh token
 */
function generateSecureRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate access and refresh token pair (for phone auth compatibility)
 * @param {Object} payload - User data to include in tokens
 * @returns {Object} Object containing accessToken and refreshToken
 */
async function generateTokenPair(payload) {
  const accessToken = generateAccessToken(payload);
  const { token: refreshToken } = await issueRefreshToken({
    userType: payload.type || 'passenger',
    userId: payload.id,
    metadata: { phone: payload.phone }
  });
  
  return {
    accessToken,
    refreshToken
  };
}

/**
 * Generate token for phone-verified user (legacy function)
 * @param {Object} user - User object with id and phone
 * @returns {string} JWT token
 */
function generateUserToken(user) {
  return generateAccessToken({
    id: user.id,
    phone: user.phone,
    type: 'user',
    verified: true
  });
}

module.exports = {
  generateAccessToken,
  generateToken,
  verifyToken,
  generateTokenPair,
  generateUserToken,
  generateSecureRefreshToken,
  issueRefreshToken,
  rotateRefreshToken,
  generateRandomTokenString,
  hashToken,
  compareHashedToken,
  addDays
};
