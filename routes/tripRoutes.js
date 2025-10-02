const express = require("express");
const router = express.Router();
const controller = require("../controllers/tripController");
const { authorize } = require("../middleware/auth");

// Trip management routes
router.get("/:id", authorize("admin", "driver", "passenger"), controller.getTripDetails);
router.patch("/:id/pickup", authorize("passenger"), controller.confirmPickup);
router.patch("/:id/dropoff", authorize("passenger"), controller.confirmDropoff);

module.exports = router;