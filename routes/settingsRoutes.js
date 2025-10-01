const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settingsController');
const auth = require('../middleware/auth');
const { requireRoles, requirePermissions } = require('../middleware/rbac');

// Public
router.get('/', ctrl.getPublicSettings);

// Admin
router.post('/', auth(), requireRoles('admin', 'superadmin'), ctrl.upsertSettings);
router.put('/', auth(), requireRoles('admin', 'superadmin'), ctrl.upsertSettings);

module.exports = router;

