const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');
const auth = require('../middleware/auth');

// User dispute routes (passengers and drivers)
router.post('/', auth(), disputeController.createDispute);
router.get('/', auth(), disputeController.getUserDisputes);
router.get('/:id', auth(), disputeController.getDisputeDetails);
router.post('/:id/replies', auth(), disputeController.addDisputeReply);
router.patch('/:id/status', auth(), disputeController.updateDisputeStatus);

module.exports = router;