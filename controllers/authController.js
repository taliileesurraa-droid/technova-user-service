const jwt = require('jsonwebtoken');
const { models } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
require('dotenv').config();

/* ---------------------- JWT ---------------------- */
function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
}

function buildBasicClaims(entity, type) {
  try {
    const claims = {};
    if (type === 'passenger') {
      if (entity.name) claims.name = entity.name;
      if (entity.phone) claims.phone = entity.phone;
      if (entity.email) claims.email = entity.email;
    } else if (type === 'driver') {
      if (entity.name) claims.name = entity.name;
      if (entity.phone) claims.phone = entity.phone;
      if (entity.email) claims.email = entity.email;
      if (typeof entity.status !== 'undefined') claims.status = entity.status;
      if (typeof entity.documentStatus !== 'undefined') claims.documentStatus = entity.documentStatus;
      if (typeof entity.driverStatus !== 'undefined') claims.driverStatus = entity.driverStatus;
      if (typeof entity.vehicleType !== 'undefined') claims.vehicleType = entity.vehicleType;
      if (typeof entity.carName !== 'undefined') claims.carName = entity.carName;
      if (typeof entity.carPlate !== 'undefined') claims.carPlate = entity.carPlate;
    } else if (type === 'staff') {
      if (entity.fullName) claims.name = entity.fullName;
      if (entity.username) claims.username = entity.username;
      if (entity.status) claims.status = entity.status;
    } else if (type === 'admin') {
      if (entity.fullName) claims.name = entity.fullName;
      if (entity.username) claims.username = entity.username;
      if (entity.email) claims.email = entity.email;
    }
    return claims;
  } catch (_) {
    return {};
  }
}

/* ---------------------- UTIL ---------------------- */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('09') || clean.startsWith('07')) return '+251' + clean.substring(1);
  if (clean.startsWith('251')) return '+' + clean;
  if (phone.startsWith('+251')) return phone;
  return phone;
}

/* ========================= PASSENGER ========================= */
exports.registerPassenger = async (req, res) => {
  try {
    const { name, phone, email, password, emergencyContacts } = req.body;
    const exists = await models.Passenger.findOne({ where: { phone } });
    if (exists) return res.status(409).json({ message: 'Phone already registered' });

    const hashed = await hashPassword(password);
    const passenger = await models.Passenger.create({ name, phone, email, emergencyContacts, password: hashed });

    const token = sign({
      id: passenger.id,
      type: 'passenger',
      ...buildBasicClaims(passenger, 'passenger'),
    });

    return res.status(201).json({ token, passenger });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.loginPassenger = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const passenger = await models.Passenger.unscoped().findOne({ where: { email } });
    if (!passenger) return res.status(404).json({ message: 'Not found' });

    const ok = await comparePassword(password, passenger.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = sign({
      id: passenger.id,
      type: 'passenger',
      ...buildBasicClaims(passenger, 'passenger'),
    });

    return res.json({ token, passenger });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/* ========================= DRIVER ========================= */
exports.registerDriver = async (req, res) => {
  try {
    const { name, phone, email, password, vehicleType, carName, paymentPreference } = req.body;
    
    // Validate vehicleType if provided
    if (vehicleType && !['mini', 'sedan', 'van', 'suv', 'mpv', 'motorbike', 'bajaj'].includes(vehicleType)) {
      return res.status(400).json({ 
        message: 'Invalid vehicleType. Must be one of: mini, sedan, van, suv, mpv, motorbike, bajaj' 
      });
    }
    if (paymentPreference && !Number.isInteger(paymentPreference)) {
      return res.status(400).json({ message: 'paymentPreference must be an integer' });
    }
    
    // Validate carName if provided
    if (carName && (typeof carName !== 'string' || carName.trim().length === 0)) {
      return res.status(400).json({ 
        message: 'Invalid carName. Must be a non-empty string' 
      });
    }
    
    const exists = await models.Driver.findOne({ where: { phone } });
    if (exists) return res.status(409).json({ message: 'Phone already registered' });

    const hashed = await hashPassword(password);
    const driver = await models.Driver.create({ name, phone, email, password: hashed, vehicleType, carName, paymentPreference });

    const token = sign({
      id: driver.id,
      driverId: driver.id,
      type: 'driver',
      paymentPreference: paymentPreference || null,
      ...buildBasicClaims(driver, 'driver'),
    });

    return res.status(201).json({ token, driver });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.loginDriver = async (req, res) => {
  try {
    const { email, password, otp, phoneNumber } = req.body || {};

    // Flow A: Phone + OTP
    if (phoneNumber && otp) {
      const phone = normalizePhone(phoneNumber);
      const driver = await models.Driver.findOne({ where: { phone } });
      if (!driver) return res.status(404).json({ message: 'Driver not found' });

      const createAdvancedOtpUtil = require('../utils/createAdvancedOtpUtil');
      const otpUtil = createAdvancedOtpUtil({ token: process.env.GEEZSMS_TOKEN });

      try {
        await otpUtil.verifyOtp({ referenceType: 'Driver', referenceId: driver.id, token: otp, phoneNumber: phone });
      } catch (e) {
        const msg = e?.message || 'OTP verification failed';
        const code = /expired|Invalid|No valid|locked/i.test(msg) ? 401 : 500;
        return res.status(code).json({ message: msg });
      }

      driver.verification = true;
      if (driver.status === 'pending') driver.status = 'active';
      await driver.save();

      const token = sign({ id: driver.id, driverId: driver.id, type: 'driver', ...buildBasicClaims(driver, 'driver') });
      return res.json({ token, driver });
    }

    // Flow B: Email + Password
    if (email && password) {
      const driver = await models.Driver.unscoped().findOne({ where: { email } });
      if (!driver) return res.status(404).json({ message: 'Driver not found' });

      const ok = await comparePassword(password, driver.password);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

      const token = sign({ id: driver.id, driverId: driver.id, type: 'driver', paymentPreference: driver.paymentPreference || null, ...buildBasicClaims(driver, 'driver') });
      const { password: _pw, ...safeDriver } = driver.toJSON ? driver.toJSON() : driver;
      return res.json({ token, driver: safeDriver });
    }

    return res.status(400).json({ message: 'Provide either email/password or phoneNumber/otp' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.sendDriverOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    if (!phoneNumber) return res.status(400).json({ message: 'phoneNumber is required' });

    const phone = normalizePhone(phoneNumber);
    const driver = await models.Driver.findOne({ where: { phone } });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const createAdvancedOtpUtil = require('../utils/createAdvancedOtpUtil');
    const otpUtil = createAdvancedOtpUtil({
      token: process.env.GEEZSMS_TOKEN,
      otpExpirationSeconds: 300,
      maxAttempts: 3,
      lockoutSeconds: 1800,
    });

    const resp = await otpUtil.generateAndSendOtp({ referenceType: 'Driver', referenceId: driver.id, phoneNumber: phone });
    return res.status(200).json({ message: 'OTP sent successfully', phoneNumber: phone, expiresIn: resp.expiresIn });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.verifyDriverOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body || {};
    if (!phoneNumber || !otp) return res.status(400).json({ message: 'phoneNumber and otp are required' });

    const phone = normalizePhone(phoneNumber);
    const driver = await models.Driver.findOne({ where: { phone } });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    const createAdvancedOtpUtil = require('../utils/createAdvancedOtpUtil');
    const otpUtil = createAdvancedOtpUtil({ token: process.env.GEEZSMS_TOKEN });

    await otpUtil.verifyOtp({ referenceType: 'Driver', referenceId: driver.id, token: otp, phoneNumber: phone });

    driver.verification = true;
    if (driver.status === 'pending') driver.status = 'active';
    await driver.save();

    const token = sign({ id: driver.id, type: 'driver', paymentPreference: driver.paymentPreference || null, ...buildBasicClaims(driver, 'driver') });
    return res.status(200).json({ message: 'OTP verified successfully', driver, token });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/* ========================= STAFF ========================= */
exports.registerStaff = async (req, res) => {
  try {
    const { fullName, username, password } = req.body;
    const exists = await models.Staff.findOne({ where: { username } });
    if (exists) return res.status(409).json({ message: 'Username already exists' });

    const hashed = await hashPassword(password);
    const staff = await models.Staff.create({ fullName, username, password: hashed });

    const token = sign({ id: staff.id, type: 'staff', roles: [], permissions: [] });
    return res.status(201).json({ token, staff });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.loginStaff = async (req, res) => {
  try {
    const { username, password } = req.body;
    const staff = await models.Staff.unscoped().findOne({ where: { username }, include: [{ association: 'roles', include: ['permissions'] }] });
    if (!staff) return res.status(404).json({ message: 'Not found' });

    const ok = await comparePassword(password, staff.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const roles = (staff.roles || []).map(r => r.name);
    const perms = Array.from(new Set((staff.roles || []).flatMap(r => (r.permissions || []).map(p => p.name))));

    const token = sign({ id: staff.id, type: 'staff', roles, permissions: perms });
    return res.json({ token, staff });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/* ========================= ADMIN ========================= */
exports.registerAdmin = async (req, res) => {
  try {
    const { fullName, username, password } = req.body;
    const exists = await models.Admin.findOne({ where: { username } });
    if (exists) return res.status(409).json({ message: 'Username already exists' });

    const hashed = await hashPassword(password);
    const admin = await models.Admin.create({ fullName, username, password: hashed });

    const token = sign({ id: admin.id, type: 'admin', roles: ['superadmin'], permissions: [] });

    const cleanAdmin = {
      id: admin.id,
      fullName: admin.fullName,
      username: admin.username,
      email: admin.email,
      roles: ['superadmin'],
    };

    return res.status(201).json({ token, admin: cleanAdmin });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await models.Admin.unscoped().findOne({ where: { username }, include: [{ association: 'roles', include: ['permissions'] }] });
    if (!admin) return res.status(404).json({ message: 'Not found' });

    const ok = await comparePassword(password, admin.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const roles = (admin.roles || []).map(r => r.name);
    const isSuperAdmin = roles.includes('superadmin');

    const token = sign({
      id: admin.id,
      type: 'admin',
      roles,
      permissions: isSuperAdmin ? [] : Array.from(new Set((admin.roles || []).flatMap(r => (r.permissions || []).map(p => p.name)))),
    });

    const cleanAdmin = {
      id: admin.id,
      fullName: admin.fullName,
      username: admin.username,
      email: admin.email,
      roles,
    };

    return res.json({ token, admin: cleanAdmin });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

/* ========================= PASSWORD MANAGEMENT ========================= */
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const passengerId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    // Find passenger
    const passenger = await models.Passenger.unscoped().findByPk(passengerId);
    if (!passenger) {
      return res.status(404).json({ message: 'Passenger not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, passenger.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await models.Passenger.update(
      { password: hashedPassword },
      { where: { id: passengerId } }
    );

    return res.status(200).json({ 
      message: 'Password has been updated successfully' 
    });
  } catch (e) {
    console.error('Update password error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    
    if (!email || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        message: 'Email, current password, and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters long' 
      });
    }

    // Find passenger by email
    const passenger = await models.Passenger.unscoped().findOne({ where: { email } });
    if (!passenger) {
      return res.status(404).json({ message: 'Passenger not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, passenger.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await models.Passenger.update(
      { password: hashedPassword },
      { where: { id: passenger.id } }
    );

    return res.status(200).json({ 
      message: 'Password has been reset successfully' 
    });
  } catch (e) {
    console.error('Reset password error:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
