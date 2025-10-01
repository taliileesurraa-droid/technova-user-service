const { models } = require('../models');

// Public: get settings (latest row)
exports.getPublicSettings = async (req, res) => {
try {
const row = await models.AppSettings.findOne({ order: [['updatedAt', 'DESC']] });
return res.json(row || {});
} catch (e) { return res.status(500).json({ message: e.message }); }
};

// Admin: create or update single settings row (upsert semantics)
exports.upsertSettings = async (req, res) => {
try {
const data = req.body || {};
const existing = await models.AppSettings.findOne({ order: [['updatedAt', 'DESC']] });
if (existing) {
  await existing.update({
    terms: data.terms ?? existing.terms,
    privacy: data.privacy ?? existing.privacy,
    contactEmail: data.contactEmail ?? existing.contactEmail,
    contactPhone: data.contactPhone ?? existing.contactPhone,
    contactAddress: data.contactAddress ?? existing.contactAddress,
    updatedByAdminId: req.user?.id || existing.updatedByAdminId,
  });
  return res.json(existing);
}
const created = await models.AppSettings.create({
  terms: data.terms || null,
  privacy: data.privacy || null,
  contactEmail: data.contactEmail || null,
  contactPhone: data.contactPhone || null,
  contactAddress: data.contactAddress || null,
  updatedByAdminId: req.user?.id || null,
});
return res.status(201).json(created);
} catch (e) { return res.status(500).json({ message: e.message }); }
};

