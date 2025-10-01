const { models } = require('../models');
const { hashPassword, comparePassword } = require('../utils/password');
const createAdvancedOtpUtil = require('../utils/createAdvancedOtpUtil');
const crypto = require('crypto');

const otpUtil = createAdvancedOtpUtil({
  token: process.env.GEEZSMS_TOKEN,
  otpLength: 6,
  otpExpirationSeconds: 300,
  maxAttempts: 3,
  lockoutSeconds: 1800,
});

function normalizePhone(phone) {
  const clean = String(phone || '').replace(/\D/g, '');
  if (clean.startsWith('09') || clean.startsWith('07')) return '+251' + clean.substring(1);
  if (clean.startsWith('251')) return '+' + clean;
  if (String(phone).startsWith('+251')) return String(phone);
  return phone;
}

// Passenger password reset/update not applicable for OTP-registered users per requirements

function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// Driver: request password reset via email token
exports.requestDriverPasswordResetEmail = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'email is required' });
    const driver = await models.Driver.findOne({ where: { email } });
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = addMinutes(new Date(), 30);
    await models.PasswordResetToken.create({ userType: 'driver', userId: driver.id, token, expiresAt });
    // TODO: Integrate real email service; for now return token for testing
    return res.status(200).json({ message: 'Password reset email sent', token, expiresInMinutes: 30 });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Driver: confirm password reset via email token
exports.confirmDriverPasswordResetEmail = async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ message: 'token and newPassword are required' });
    const row = await models.PasswordResetToken.findOne({ where: { token, userType: 'driver', usedAt: null } });
    if (!row) return res.status(400).json({ message: 'Invalid token' });
    if (new Date(row.expiresAt) < new Date()) return res.status(400).json({ message: 'Token expired' });
    const driver = await models.Driver.unscoped().findByPk(row.userId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    const hashed = await hashPassword(newPassword);
    await models.Driver.update({ password: hashed }, { where: { id: driver.id } });
    row.usedAt = new Date();
    await row.save();
    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

// Driver password reset is not via OTP per latest requirements. Intentionally omitted.

