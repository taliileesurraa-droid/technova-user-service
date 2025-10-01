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

// ✅ all routes require authentication
router.use(authenticate);

// Mount routes with appropriate prefixes
router.use("/discounts", authorize("admin"), discountRoutes);
router.use("/contracts", contractRoutes);
router.use("/payments", paymentRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/schedules", scheduleRoutes);

// Export the main router
module.exports = router;
