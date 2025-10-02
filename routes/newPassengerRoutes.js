const express = require("express");
const router = express.Router();
const controller = require("../controllers/newSubscriptionController");
const { authorize } = require("../middleware/auth");

// Passenger subscription management
router.get("/:id/subscriptions", authorize("admin", "passenger"), controller.getPassengerSubscriptions);

module.exports = router;