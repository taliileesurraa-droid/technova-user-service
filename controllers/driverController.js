const { models } = require('../models');
const { hashPassword } = require('../utils/password');

exports.create = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const row = await models.Driver.create(data);
return res.status(201).json(row);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.list = async (req, res) => { try { const rows = await models.Driver.findAll({ include: ['roles'] }); return res.json(rows); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.get = async (req, res) => { try { const row = await models.Driver.findByPk(req.params.id, { include: ['roles'] }); if (!row) return res.status(404).json({ message: 'Not found' }); return res.json(row); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.update = async (req, res) => {
try {
const body = req.body || {};
// Prevent updates to rating fields from admin route
const data = { ...body };

// Validate vehicleType if provided
if (data.vehicleType && !['mini', 'sedan', 'van', 'suv', 'mpv', 'motorbike', 'bajaj'].includes(data.vehicleType)) {
  return res.status(400).json({ 
    message: 'Invalid vehicleType. Must be one of: mini, sedan, van, suv, mpv, motorbike, bajaj' 
  });
}
if (data.paymentPreference && !Number.isInteger(data.paymentPreference)) {
  return res.status(400).json({ message: 'paymentPreference must be an integer' });
}

// Validate carName if provided
if (data.carName && (typeof data.carName !== 'string' || data.carName.trim().length === 0)) {
  return res.status(400).json({ 
    message: 'Invalid carName. Must be a non-empty string' 
  });
}

// Validate driverStatus if provided
if (data.driverStatus && !['active', 'inactive', 'suspended'].includes(data.driverStatus)) {
  return res.status(400).json({ 
    message: 'Invalid driverStatus. Must be one of: active, inactive, suspended' 
  });
}

if ('rating' in data) delete data.rating;
if ('ratingCount' in data) delete data.ratingCount;
if (data.password) data.password = await hashPassword(data.password);
const [count] = await models.Driver.update(data, { where: { id: req.params.id } });
if (!count) return res.status(404).json({ message: 'Not found' });
const updated = await models.Driver.findByPk(req.params.id);
return res.json(updated);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.remove = async (req, res) => { try { const count = await models.Driver.destroy({ where: { id: req.params.id } }); if (!count) return res.status(404).json({ message: 'Not found' }); return res.status(204).send(); } catch (e) { return res.status(500).json({ message: e.message }); } };

// Driver self-control methods
exports.getMyProfile = async (req, res) => {
try {
if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can access this endpoint' });
const driver = await models.Driver.findByPk(req.user.id, { include: ['roles'] });
if (!driver) return res.status(404).json({ message: 'Driver not found' });
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.updateMyProfile = async (req, res) => {
try {
if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can access this endpoint' });
const data = { ...req.body };

// Validate vehicleType if provided
if (data.vehicleType && !['mini', 'sedan', 'van', 'suv', 'mpv', 'motorbike', 'bajaj'].includes(data.vehicleType)) {
  return res.status(400).json({ 
    message: 'Invalid vehicleType. Must be one of: mini, sedan, van, suv, mpv, motorbike, bajaj' 
  });
}

// Validate carName if provided
if (data.carName && (typeof data.carName !== 'string' || data.carName.trim().length === 0)) {
  return res.status(400).json({ 
    message: 'Invalid carName. Must be a non-empty string' 
  });
}
// Prevent self-updating rating fields and status
if ('rating' in data) delete data.rating;
if ('ratingCount' in data) delete data.ratingCount;
if ('status' in data) delete data.status;
if ('verification' in data) return res.status(403).json({ message: 'Forbidden' });
if ('documentStatus' in data) return res.status(403).json({ message: 'Forbidden' });
if ('driverStatus' in data) return res.status(403).json({ message: 'Cannot update driver status directly. Contact support.' });
if (data.paymentPreference && !Number.isInteger(data.paymentPreference)) {
  return res.status(400).json({ message: 'paymentPreference must be an integer' });
}
if (data.password) data.password = await hashPassword(data.password);
const [count] = await models.Driver.update(data, { where: { id: req.user.id } });
if (!count) return res.status(404).json({ message: 'Driver not found' });
const updated = await models.Driver.findByPk(req.user.id);
return res.json(updated);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Driver: change password (authenticated)
exports.changeMyPassword = async (req, res) => {
try {
if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can access this endpoint' });
const { currentPassword, newPassword } = req.body || {};
if (!currentPassword || !newPassword) return res.status(400).json({ message: 'currentPassword and newPassword are required' });
const driver = await models.Driver.unscoped().findByPk(req.user.id);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
const { comparePassword, hashPassword } = require('../utils/password');
const ok = await comparePassword(currentPassword, driver.password);
if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });
const hashed = await hashPassword(newPassword);
await models.Driver.update({ password: hashed }, { where: { id: driver.id } });
return res.json({ message: 'Password changed successfully' });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.toggleMyAvailability = async (req, res) => {
try {
if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can toggle availability' });
const driver = await models.Driver.findByPk(req.user.id);
if (!driver) return res.status(404).json({ message: 'Driver not found' });

// Check driver status
if (driver.status === 'pending') {
  return res.status(403).json({ 
    message: 'Cannot change availability. Your account is still pending approval. Please contact support.' 
  });
}

if (driver.status === 'suspended') {
  return res.status(403).json({ 
    message: 'Cannot change availability. Your account has been suspended. Please contact support.' 
  });
}

if (driver.driverStatus === 'suspended') {
  return res.status(403).json({ 
    message: 'Cannot change availability. Your driver status is suspended. Please contact support.' 
  });
}

if (driver.driverStatus === 'inactive') {
  return res.status(403).json({ 
    message: 'Cannot change availability. Your driver status is inactive. Please contact support.' 
  });
}

driver.availability = !driver.availability;
await driver.save();
return res.json({ 
  message: 'Availability updated', 
  availability: driver.availability,
  status: driver.status,
  driverStatus: driver.driverStatus 
});
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.checkBookingEligibility = async (req, res) => {
try {
if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can check booking eligibility' });
const driver = await models.Driver.findByPk(req.user.id);
if (!driver) return res.status(404).json({ message: 'Driver not found' });

const approvalEligible = driver.status === 'approved' || driver.documentStatus === 'approved';
const statusEligible = driver.driverStatus === 'active';
const eligible = approvalEligible && statusEligible;

if (!eligible) {
  const required = ['carPlate','carModel','carColor','document','nationalIdFile','vehicleRegistrationFile','insuranceFile'];
  const missing = required.filter((k) => driver[k] == null || driver[k] === '');
  const docState = driver.documentStatus || 'not submitted';
  
  let reason;
  if (!approvalEligible) {
    reason = driver.status !== 'approved'
      ? `Account status is '${driver.status}'. Approval required.`
      : `Driver documents are '${docState}'. Approval required.`;
  } else if (!statusEligible) {
    reason = `Driver status is '${driver.driverStatus}'. Active status required to accept bookings.`;
  }
  
  return res.status(403).json({
    message: reason,
    status: driver.status,
    driverStatus: driver.driverStatus,
    missing
  });
}
return res.json({ canAcceptBookings: true, status: driver.status, driverStatus: driver.driverStatus });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.toggleAvailability = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.id);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.availability = !driver.availability;
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.uploadDocuments = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.id);
if (!driver) return res.status(404).json({ message: 'Driver not found' });

const updateData = {};

if (req.files) {
  if (req.files.nationalId && req.files.nationalId[0]) updateData.nationalIdFile = req.files.nationalId[0].filename;
  if (req.files.vehicleRegistration && req.files.vehicleRegistration[0]) updateData.vehicleRegistrationFile = req.files.vehicleRegistration[0].filename;
  if (req.files.insurance && req.files.insurance[0]) updateData.insuranceFile = req.files.insurance[0].filename;
  if (req.files.document && req.files.document[0]) updateData.document = req.files.document[0].filename;
  if (req.files.license && req.files.license[0]) updateData.drivingLicenseFile = req.files.license[0].filename;
}

// Ensure all required docs are present either already or in this upload
const required = ['nationalIdFile', 'vehicleRegistrationFile', 'insuranceFile', 'document', 'drivingLicenseFile'];
const missing = required.filter(k => !(updateData[k] || driver[k]));
if (missing.length) {
  return res.status(400).json({ message: 'Missing required documents', missing });
}

if (Object.keys(updateData).length > 0) {
  updateData.documentStatus = 'pending';
  updateData.status = 'pending';
  updateData.verification = false;
  await models.Driver.update(updateData, { where: { id: req.params.id } });
}

const updated = await models.Driver.findByPk(req.params.id);
// Build file metadata array
const filesMeta = [];
const basePath = 'uploads/drivers';
if (req.files) {
  const pushMeta = (field) => {
    const f = req.files[field] && req.files[field][0];
    if (f) {
      filesMeta.push({ field, filename: f.filename, mimetype: f.mimetype, path: `${basePath}/${f.filename}` });
    }
  };
  pushMeta('nationalId');
  pushMeta('vehicleRegistration');
  pushMeta('insurance');
  pushMeta('document');
  pushMeta('license');
}
return res.json({ message: 'Documents uploaded successfully', driver: updated, files: filesMeta });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Driver rates passenger
exports.ratePassenger = async (req, res) => {
try {
if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can rate passengers' });
const { rating, comment } = req.body;
const passengerId = req.params.passengerId;

const passenger = await models.Passenger.findByPk(passengerId);
if (!passenger) return res.status(404).json({ message: 'Passenger not found' });

// Set rating directly, capped between 0 and 5 (no ratingCount)
const value = Number(rating);
if (!Number.isFinite(value)) return res.status(400).json({ message: 'Invalid rating' });
const newRating = Math.max(0, Math.min(5, value));

await models.Passenger.update({ rating: newRating }, { where: { id: passengerId } });
const updatedPassenger = await models.Passenger.findByPk(passengerId);
return res.json({ message: 'Passenger rated successfully', passenger: updatedPassenger, rating, comment });
} catch (e) { return res.status(500).json({ message: e.message }); }
};
