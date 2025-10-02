const { ContractSettings, Subscription } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { getDriverById, getPassengerById } = require("../utils/userService");

// POST /admin/contract/settings - Set contract base price per km and discounts
exports.setContractSettings = asyncHandler(async (req, res) => {
  const {
    contract_type,
    base_price_per_km,
    discount_percentage = 0,
    minimum_fare = 0,
  } = req.body;

  // Validate required fields
  if (!contract_type || !base_price_per_km) {
    return res.status(400).json({
      success: false,
      message: "contract_type and base_price_per_km are required"
    });
  }

  // Validate contract type
  if (!["INDIVIDUAL", "GROUP", "INSTITUTIONAL"].includes(contract_type)) {
    return res.status(400).json({
      success: false,
      message: "Invalid contract_type. Must be one of: INDIVIDUAL, GROUP, INSTITUTIONAL"
    });
  }

  // Validate numeric values
  if (isNaN(base_price_per_km) || parseFloat(base_price_per_km) < 0) {
    return res.status(400).json({
      success: false,
      message: "base_price_per_km must be a positive number"
    });
  }

  if (isNaN(discount_percentage) || parseFloat(discount_percentage) < 0 || parseFloat(discount_percentage) > 100) {
    return res.status(400).json({
      success: false,
      message: "discount_percentage must be between 0 and 100"
    });
  }

  try {
    // Check if settings already exist for this contract type
    const existingSettings = await ContractSettings.findOne({
      where: { contract_type }
    });

    let settings;
    if (existingSettings) {
      // Update existing settings
      await existingSettings.update({
        base_price_per_km: parseFloat(base_price_per_km),
        discount_percentage: parseFloat(discount_percentage),
        minimum_fare: parseFloat(minimum_fare),
        is_active: true,
        created_by: req.user.id,
      });
      settings = existingSettings;
    } else {
      // Create new settings
      settings = await ContractSettings.create({
        contract_type,
        base_price_per_km: parseFloat(base_price_per_km),
        discount_percentage: parseFloat(discount_percentage),
        minimum_fare: parseFloat(minimum_fare),
        is_active: true,
        created_by: req.user.id,
      });
    }

    res.status(existingSettings ? 200 : 201).json({
      success: true,
      message: `Contract settings ${existingSettings ? 'updated' : 'created'} successfully`,
      data: settings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error setting contract settings",
      error: error.message
    });
  }
});

// GET /admin/contract/settings - Get all contract settings
exports.getContractSettings = asyncHandler(async (req, res) => {
  try {
    const settings = await ContractSettings.findAll({
      where: { is_active: true },
      order: [['contract_type', 'ASC']],
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching contract settings",
      error: error.message
    });
  }
});

// POST /admin/subscription/:id/assign-driver - Assign driver to passenger subscription
exports.assignDriverToSubscription = asyncHandler(async (req, res) => {
  const subscriptionId = req.params.id;
  const { driver_id } = req.body;

  if (!driver_id) {
    return res.status(400).json({
      success: false,
      message: "driver_id is required"
    });
  }

  try {
    // Find the subscription
    const subscription = await Subscription.findByPk(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found"
      });
    }

    // Verify driver exists
    const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
    const driverInfo = await getDriverById(driver_id, authHeader);
    if (!driverInfo) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    // Update subscription with driver assignment
    await subscription.update({
      driver_id: driver_id,
    });

    // Get passenger info for response
    let passengerInfo = null;
    try {
      passengerInfo = await getPassengerById(subscription.passenger_id, authHeader);
    } catch (_) {}

    res.json({
      success: true,
      message: "Driver assigned to subscription successfully",
      data: {
        subscription: {
          ...subscription.toJSON(),
          passenger_name: passengerInfo?.name || null,
          passenger_phone: passengerInfo?.phone || null,
          passenger_email: passengerInfo?.email || null,
          driver_name: driverInfo.name || null,
          driver_phone: driverInfo.phone || null,
          driver_email: driverInfo.email || null,
          vehicle_info: {
            car_model: driverInfo.carModel,
            car_plate: driverInfo.carPlate,
            car_color: driverInfo.carColor,
          }
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error assigning driver to subscription",
      error: error.message
    });
  }
});

// GET /admin/subscriptions - Get all subscriptions for admin management
exports.getAllSubscriptions = asyncHandler(async (req, res) => {
  const { status, payment_status, contract_type } = req.query;

  try {
    let whereClause = {};
    
    if (status) {
      whereClause.status = status;
    }
    if (payment_status) {
      whereClause.payment_status = payment_status;
    }
    if (contract_type) {
      whereClause.contract_type = contract_type;
    }

    const subscriptions = await Subscription.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });

    // Get user information for enrichment
    const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
    const uniquePassengerIds = [...new Set(subscriptions.map(s => s.passenger_id).filter(Boolean))];
    const uniqueDriverIds = [...new Set(subscriptions.map(s => s.driver_id).filter(Boolean))];
    
    const [passengerInfoMap, driverInfoMap] = await Promise.all([
      Promise.all(uniquePassengerIds.map(async (pid) => {
        try {
          const info = await getPassengerById(pid, authHeader);
          return [pid, info];
        } catch (_) { return [pid, null]; }
      })).then(results => new Map(results.filter(([,v]) => v))),
      Promise.all(uniqueDriverIds.map(async (did) => {
        try {
          const info = await getDriverById(did, authHeader);
          return [did, info];
        } catch (_) { return [did, null]; }
      })).then(results => new Map(results.filter(([,v]) => v)))
    ]);

    // Enrich subscriptions with user information
    const enrichedSubscriptions = subscriptions.map(subscription => {
      const subData = subscription.toJSON();
      const passengerInfo = passengerInfoMap.get(subscription.passenger_id);
      const driverInfo = driverInfoMap.get(subscription.driver_id);
      
      return {
        ...subData,
        passenger_name: passengerInfo?.name || null,
        passenger_phone: passengerInfo?.phone || null,
        passenger_email: passengerInfo?.email || null,
        driver_name: driverInfo?.name || null,
        driver_phone: driverInfo?.phone || null,
        driver_email: driverInfo?.email || null,
        vehicle_info: driverInfo ? {
          car_model: driverInfo.carModel,
          car_plate: driverInfo.carPlate,
          car_color: driverInfo.carColor,
        } : null,
      };
    });

    res.json({
      success: true,
      data: {
        subscriptions: enrichedSubscriptions,
        total_count: enrichedSubscriptions.length,
        filters_applied: { status, payment_status, contract_type }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching subscriptions",
      error: error.message
    });
  }
});