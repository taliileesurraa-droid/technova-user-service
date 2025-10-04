const express = require("express");
const router = express.Router();
const controller = require("../controllers/newSubscriptionController");
const { authorize } = require("../middleware/auth");

// Subscription creation and payment routes
router.get("/contracts", authorize("passenger", "admin"), controller.getAvailableContracts);
router.post("/create", authorize("passenger"), controller.createSubscription);
router.post("/:id/payment", authorize("admin", "passenger"), controller.processPayment);

module.exports = router;