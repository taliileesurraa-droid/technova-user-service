const { models, Op } = require('../models');
const { hashPassword } = require('../utils/password');

function getMissingDriverApprovalFields(driver) {
const required = ['carPlate','carModel','carColor','drivingLicenseFile','document','nationalIdFile','vehicleRegistrationFile','insuranceFile'];
const missing = required.filter((k) => driver[k] == null || driver[k] === '');
return missing;
}

// Admin creates a new passenger
exports.createPassenger = async (req, res) => {
try {
const { name, phone, email, password, emergencyContacts } = req.body || {};
if (!name || !phone || !password) {
  return res.status(400).json({ message: 'name, phone, and password are required' });
}

// Normalize phone if utils exist
let normalizedPhone = phone;
try {
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('09') || cleaned.startsWith('07')) normalizedPhone = '+251' + cleaned.substring(1);
  else if (cleaned.startsWith('251')) normalizedPhone = '+' + cleaned;
} catch (_) {}

const exists = await models.Passenger.findOne({ where: { phone: normalizedPhone } });
if (exists) return res.status(409).json({ message: 'Phone already registered' });

const hashed = await hashPassword(password);
const passenger = await models.Passenger.create({ name, phone: normalizedPhone, email: email || null, emergencyContacts: emergencyContacts || null, password: hashed });

const cleanPassenger = { id: passenger.id, name: passenger.name, phone: passenger.phone, email: passenger.email };
return res.status(201).json({ passenger: cleanPassenger });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.create = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const row = await models.Admin.create(data);
return res.status(201).json(row);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.list = async (req, res) => { try { const rows = await models.Admin.findAll({ include: ['roles'] }); return res.json(rows); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.get = async (req, res) => { try { const row = await models.Admin.findByPk(req.params.id, { include: ['roles'] }); if (!row) return res.status(404).json({ message: 'Not found' }); return res.json(row); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.update = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const [count] = await models.Admin.update(data, { where: { id: req.params.id } });
if (!count) return res.status(404).json({ message: 'Not found' });
const updated = await models.Admin.findByPk(req.params.id);
return res.json(updated);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.remove = async (req, res) => { try { const count = await models.Admin.destroy({ where: { id: req.params.id } }); if (!count) return res.status(404).json({ message: 'Not found' }); return res.status(204).send(); } catch (e) { return res.status(500).json({ message: e.message }); } };

exports.approveDriver = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
const missing = getMissingDriverApprovalFields(driver);
if (missing.length) {
  return res.status(400).json({ message: 'Missing required fields for approval', missing });
}
driver.verification = true;
driver.documentStatus = 'approved';
driver.status = 'approved';
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.approveDriverDocuments = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
const missing = getMissingDriverApprovalFields(driver);
if (missing.length) {
  return res.status(400).json({ message: 'Missing required fields for approval', missing });
}
driver.documentStatus = 'approved';
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.rejectDriverDocuments = async (req, res) => {
try {
const driver = await models.Driver.findByPk(req.params.driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.documentStatus = 'rejected';
await driver.save();
return res.json(driver);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.getPendingDriverDocuments = async (req, res) => {
try {
// Return any drivers whose account/documents are pending review
const drivers = await models.Driver.findAll({
  where: {
    [Op.or]: [
      { status: 'pending' },
      { documentStatus: 'pending' },
      { documentStatus: null },
      { documentStatus: '' }
    ]
  }
});
return res.json(drivers);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.filterByRole = async (req, res) => {
try {
const { role } = req.query;
if (!role) return res.status(400).json({ message: 'Role parameter is required' });

let users = [];
switch (role.toLowerCase()) {
case 'passenger':
users = await models.Passenger.findAll({ include: ['roles'] });
break;
case 'driver':
users = await models.Driver.findAll({ include: ['roles'] });
break;
case 'staff':
users = await models.Staff.findAll({ include: ['roles'] });
break;
case 'admin':
users = await models.Admin.findAll({ include: ['roles'] });
break;
default:
return res.status(400).json({ message: 'Invalid role. Use: passenger, driver, staff, admin' });
}

return res.json(users);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

exports.listStaffByRole = async (req, res) => {
try {
const { role, roleId } = req.query; // supports role name or roleId
let include = ['roles'];
if (roleId) {
  include = [{ association: 'roles', where: { id: Number(roleId) }, required: true }];
} else if (role) {
  include = [{ association: 'roles', where: { name: role }, required: true }];
}
const staff = await models.Staff.findAll({ include });
return res.json(staff);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Award reward points to a driver (admin-only)
exports.awardDriverPoints = async (req, res) => {
try {
const { driverId } = req.params;
const { points } = req.body;
const amount = Number(points);
if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ message: 'points must be a non-zero number' });
const driver = await models.Driver.findByPk(driverId);
if (!driver) return res.status(404).json({ message: 'Driver not found' });
driver.rewardPoints = (driver.rewardPoints || 0) + amount;
await driver.save();
return res.json({ message: 'Driver points updated', driverId: driver.id, rewardPoints: driver.rewardPoints });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Award reward points to a passenger (admin-only)
exports.awardPassengerPoints = async (req, res) => {
try {
const { passengerId } = req.params;
const { points } = req.body;
const amount = Number(points);
if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ message: 'points must be a non-zero number' });
const passenger = await models.Passenger.findByPk(passengerId);
if (!passenger) return res.status(404).json({ message: 'Passenger not found' });
passenger.rewardPoints = (passenger.rewardPoints || 0) + amount;
await passenger.save();
return res.json({ message: 'Passenger points updated', passengerId: passenger.id, rewardPoints: passenger.rewardPoints });
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Update a driver's status-related fields (verification, documentStatus, availability, status)
exports.updateDriverStatus = async (req, res) => {
try {
const { id } = req.params;
const { verification, documentStatus, availability, status } = req.body || {};
const driver = await models.Driver.findByPk(id);
if (!driver) return res.status(404).json({ message: 'Driver not found' });

if (typeof verification !== 'undefined') driver.verification = Boolean(verification);
if (typeof documentStatus !== 'undefined') driver.documentStatus = documentStatus;
if (typeof availability !== 'undefined') driver.availability = Boolean(availability);

 // Optional: update high-level account status
 if (typeof status !== 'undefined') {
   let normalized = String(status).toLowerCase();
   if (normalized === 'active') normalized = 'approved';
   const allowed = ['pending', 'approved', 'suspended', 'rejected'];
   if (!allowed.includes(normalized)) {
     return res.status(400).json({ 
       message: "Invalid status. Allowed values: pending, approved, suspended, rejected." 
     });
   }
   if (normalized === 'approved') {
     const missing = getMissingDriverApprovalFields(driver);
     if (missing.length) {
       return res.status(400).json({ message: 'Missing required fields for approval', missing });
     }
   }
   driver.status = normalized;
   // Apply side-effects
   if (normalized === 'approved') {
     driver.verification = true;
     driver.documentStatus = 'approved';
   } else if (normalized === 'pending') {
     driver.verification = false;
     driver.documentStatus = 'pending';
   } else if (normalized === 'suspended') {
     driver.availability = false;
   } else if (normalized === 'rejected') {
     driver.verification = false;
     driver.documentStatus = 'rejected';
   }
 }

await driver.save();
return res.json({ message: 'Driver status updated', driver });
} catch (e) { return res.status(500).json({ message: e.message }); }
};
