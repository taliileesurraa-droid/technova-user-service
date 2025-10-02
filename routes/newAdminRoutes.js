const express = require("express");
const router = express.Router();
const controller = require("../controllers/newAdminController");
const { authorize } = require("../middleware/auth");

// Admin-only routes for contract settings and driver assignment
router.post("/contract/settings", authorize("admin"), controller.setContractSettings);
router.get("/contract/settings", authorize("admin"), controller.getContractSettings);
router.post("/subscription/:id/assign-driver", authorize("admin"), controller.assignDriverToSubscription);
router.get("/subscriptions", authorize("admin"), controller.getAllSubscriptions);

// Payment approval
router.get("/payments/pending", authorize("admin"), controller.getPendingPayments);
router.patch("/payment/:id/approve", authorize("admin"), controller.approvePayment);
router.patch("/payment/:id/reject", authorize("admin"), controller.rejectPayment);

module.exports = router;