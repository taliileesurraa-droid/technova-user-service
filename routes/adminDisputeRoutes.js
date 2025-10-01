const express = require('express');
const router = express.Router();
const adminDisputeController = require('../controllers/adminDisputeController');
const auth = require('../middleware/auth');

// Admin dispute management routes
router.get('/', auth(), adminDisputeController.getAllDisputes);
router.get('/stats', auth(), adminDisputeController.getDisputeStats);
router.get('/:id', auth(), adminDisputeController.getDisputeDetails);
router.patch('/:id/assign', auth(), adminDisputeController.assignDispute);
router.patch('/:id/status', auth(), adminDisputeController.updateDisputeStatus);
router.post('/:id/replies', auth(), adminDisputeController.addAdminReply);

module.exports = router;