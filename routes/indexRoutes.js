//routes/indexRoutes.js
const express = require("express");
const router = express.Router();
const { authenticate, authorize } = require("../middleware/auth");

// Import all route files
const contractRoutes = require("./contractRoutes");
const discountRoutes = require("./discountRoutes");
const paymentRoutes = require("./paymentRoutes");
const subscriptionRoutes = require("./subscriptionRoutes");
const scheduleRoutes = require("./scheduleRoutes");
const tripRoutes = require("./tripRoutes");
const passengerRoutes = require("./passengerRoutes");
const driverRoutes = require("./driverRoutes");
const adminRoutes = require("./adminRoutes");

// ✅ all routes require authentication
router.use(authenticate);

// Mount routes with appropriate prefixes
router.use("/discounts", authorize("admin"), discountRoutes);
router.use("/contracts", contractRoutes);
router.use("/payments", paymentRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/trips", tripRoutes);
router.use("/passenger", passengerRoutes);
router.use("/driver", driverRoutes);
router.use("/admin", adminRoutes);

// Export the main router
module.exports = router;
