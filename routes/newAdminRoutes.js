const express = require("express");
const router = express.Router();
const controller = require("../controllers/newAdminController");
const { authorize } = require("../middleware/auth");

// Admin-only routes for contract settings and driver assignment
router.post("/contract/settings", authorize("admin"), controller.setContractSettings);
router.get("/contract/settings", authorize("admin"), controller.getContractSettings);
router.post("/subscription/:id/assign-driver", authorize("admin"), controller.assignDriverToSubscription);
router.post("/subscription/passenger/:passengerId/assign-driver", authorize("admin"), async (req, res, next) => {
  // proxy to same controller, passing passenger_id and a dummy id
  req.params.id = req.params.passengerId;
  req.body = { ...(req.body || {}), passenger_id: req.params.passengerId };
  return controller.assignDriverToSubscription(req, res, next);
});
router.patch("/subscription/:id/approve", authorize("admin"), controller.approveSubscription);
router.get("/subscriptions", authorize("admin"), controller.getAllSubscriptions);
router.get("/trips", authorize("admin"), controller.getAllTrips);

// Payment approval
router.get("/payments/pending", authorize("admin"), controller.getPendingPayments);
router.patch("/payment/:id/approve", authorize("admin"), controller.approvePayment);
router.patch("/payment/:id/reject", authorize("admin"), controller.rejectPayment);

module.exports = router;