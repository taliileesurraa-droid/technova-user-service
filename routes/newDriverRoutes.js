const express = require("express");
const router = express.Router();
const controller = require("../controllers/newDriverController");
const { authorize } = require("../middleware/auth");

// Driver routes for assignments and schedule
router.get("/:id/assignments", authorize("admin", "driver"), controller.getDriverAssignments);
router.get("/:id/schedule", authorize("admin", "driver"), controller.getDriverSchedule);
router.get("/:id/earnings", authorize("admin", "driver"), controller.getDriverEarnings);

module.exports = router;