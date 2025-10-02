const { ContractSettings, Subscription, Payment, Trip, TripSchedule } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { getDriverById, getPassengerById } = require("../utils/userService");
const { approvePayment, rejectPayment, getPendingPayments } = require("./paymentController");
const { getUserInfo } = require("../utils/tokenHelper");

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

    // Enrich subscriptions with user information and trip history
    const enrichedSubscriptions = await Promise.all(
      subscriptions.map(async (subscription) => {
        const subData = subscription.toJSON();
        
        // Get user information from token
        const passengerInfo = await getUserInfo(req, subscription.passenger_id, 'passenger');
        let driverInfo = null;
        if (subscription.driver_id) {
          driverInfo = await getUserInfo(req, subscription.driver_id, 'driver');
        }

        // Get trip history for this subscription
        const trips = await Trip.findAll({
          where: { subscription_id: subscription.id },
          order: [['createdAt', 'DESC']],
          limit: 5 // Last 5 trips
        });

        // Calculate expiration details
        const endDate = new Date(subscription.end_date);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
        
        return {
          ...subData,
          passenger_name: passengerInfo?.name || subData.passenger_name || null,
          passenger_phone: passengerInfo?.phone || subData.passenger_phone || null,
          passenger_email: passengerInfo?.email || subData.passenger_email || null,
          driver_name: driverInfo?.name || subData.driver_name || null,
          driver_phone: driverInfo?.phone || subData.driver_phone || null,
          driver_email: driverInfo?.email || subData.driver_email || null,
          vehicle_info: driverInfo?.vehicle_info || subData.vehicle_info || null,
          expiration_date: subscription.end_date,
          days_until_expiry: daysUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          trip_history: trips.map(trip => ({
            id: trip.id,
            status: trip.status,
            pickup_location: trip.pickup_location,
            dropoff_location: trip.dropoff_location,
            scheduled_pickup_time: trip.scheduled_pickup_time,
            actual_pickup_time: trip.actual_pickup_time,
            actual_dropoff_time: trip.actual_dropoff_time,
            distance_km: trip.distance_km,
            fare_amount: trip.fare_amount,
            pickup_confirmed: trip.pickup_confirmed_by_passenger,
            trip_ended: trip.trip_ended_by_passenger,
          })),
          trip_count: trips.length,
        };
      })
    );

    // Separate by status for better organization
    const activeSubscriptions = enrichedSubscriptions.filter(s => s.status === "ACTIVE" && !s.is_expired);
    const pendingSubscriptions = enrichedSubscriptions.filter(s => s.status === "PENDING");
    const expiredSubscriptions = enrichedSubscriptions.filter(s => s.is_expired);

    res.json({
      success: true,
      data: {
        subscriptions: enrichedSubscriptions,
        active_subscriptions: activeSubscriptions,
        pending_subscriptions: pendingSubscriptions,
        expired_subscriptions: expiredSubscriptions,
        counters: {
          total_count: enrichedSubscriptions.length,
          active_count: activeSubscriptions.length,
          pending_count: pendingSubscriptions.length,
          expired_count: expiredSubscriptions.length,
        },
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

// PATCH /admin/subscription/:id/approve - Approve subscription and payment
exports.approveSubscription = asyncHandler(async (req, res) => {
  const subscriptionId = req.params.id;
  const adminId = req.user.id;

  try {
    const subscription = await Subscription.findByPk(subscriptionId, {
      include: [
        {
          model: Payment,
          as: "payments",
          where: { status: "PENDING" },
          required: false
        }
      ]
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found"
      });
    }

    if (subscription.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve subscription with status: ${subscription.status}`
      });
    }

    // Update subscription status
    await Subscription.update({
      status: "ACTIVE",
      payment_status: "PAID"
    }, {
      where: { id: subscriptionId }
    });

    // Approve any pending payments for this subscription
    if (subscription.payments && subscription.payments.length > 0) {
      await Promise.all(
        subscription.payments.map(payment => 
          Payment.update({
            admin_approved: true,
            approved_by: adminId,
            approved_at: new Date(),
            status: "SUCCESS"
          }, {
            where: { id: payment.id }
          })
        )
      );
    }

    // Get admin info for response
    const adminInfo = await getUserInfo(req, adminId, 'admin');
    const passengerInfo = await getUserInfo(req, subscription.passenger_id, 'passenger');

    res.json({
      success: true,
      message: "Subscription and payment approved successfully",
      data: {
        subscription_id: subscriptionId,
        approved_by: adminInfo?.name || adminId,
        approved_at: new Date(),
        passenger_name: passengerInfo?.name || null,
        new_status: "ACTIVE",
        payment_status: "PAID"
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error approving subscription",
      error: error.message
    });
  }
});

// GET /admin/trips - Get all trips with filters
exports.getAllTrips = asyncHandler(async (req, res) => {
  const { status, driverId, passengerId, start_date, end_date } = req.query;

  try {
    let whereClause = {};

    // Apply filters
    if (status) {
      whereClause.status = status;
    }
    if (driverId) {
      whereClause.driver_id = driverId;
    }
    if (passengerId) {
      whereClause.passenger_id = passengerId;
    }

    // Date range filter
    if (start_date || end_date) {
      whereClause.createdAt = {};
      if (start_date) {
        whereClause.createdAt[require("sequelize").Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.createdAt[require("sequelize").Op.lte] = new Date(end_date);
      }
    }

    const trips = await Trip.findAll({
      where: whereClause,
      include: [
        {
          model: Subscription,
          as: "subscription",
          attributes: ['id', 'contract_type', 'status', 'payment_status']
        },
        {
          model: TripSchedule,
          as: "schedule",
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    // Enrich trips with user information
    const enrichedTrips = await Promise.all(
      trips.map(async (trip) => {
        const tripData = trip.toJSON();
        
        // Get user information from token
        const passengerInfo = await getUserInfo(req, trip.passenger_id, 'passenger');
        const driverInfo = await getUserInfo(req, trip.driver_id, 'driver');

        // Calculate trip duration if both times are available
        let durationMinutes = null;
        if (trip.started_at && trip.completed_at) {
          durationMinutes = Math.round((new Date(trip.completed_at) - new Date(trip.started_at)) / (1000 * 60));
        }

        return {
          ...tripData,
          passenger_name: passengerInfo?.name || `Passenger ${trip.passenger_id.slice(-4)}`,
          passenger_phone: passengerInfo?.phone || 'Not available',
          passenger_email: passengerInfo?.email || 'Not available',
          driver_name: driverInfo?.name || `Driver ${trip.driver_id.slice(-4)}`,
          driver_phone: driverInfo?.phone || 'Not available',
          driver_email: driverInfo?.email || 'Not available',
          vehicle_info: driverInfo?.vehicle_info || null,
          trip_duration_minutes: durationMinutes,
          is_scheduled: !!tripData.schedule,
          notification_sent: tripData.schedule?.notified || false,
        };
      })
    );

    // Separate by status for better organization
    const scheduledTrips = enrichedTrips.filter(t => t.status === "SCHEDULED");
    const ongoingTrips = enrichedTrips.filter(t => t.status === "ONGOING");
    const completedTrips = enrichedTrips.filter(t => t.status === "COMPLETED");
    const cancelledTrips = enrichedTrips.filter(t => t.status === "CANCELLED");

    // Calculate statistics
    const totalDistance = completedTrips.reduce((sum, trip) => sum + (parseFloat(trip.distance_km) || 0), 0);
    const totalFare = completedTrips.reduce((sum, trip) => sum + (parseFloat(trip.fare_amount) || 0), 0);

    res.json({
      success: true,
      data: {
        trips: enrichedTrips,
        scheduled_trips: scheduledTrips,
        ongoing_trips: ongoingTrips,
        completed_trips: completedTrips,
        cancelled_trips: cancelledTrips,
        statistics: {
          total_trips: enrichedTrips.length,
          scheduled_count: scheduledTrips.length,
          ongoing_count: ongoingTrips.length,
          completed_count: completedTrips.length,
          cancelled_count: cancelledTrips.length,
          total_distance_km: Math.round(totalDistance * 100) / 100,
          total_fare: Math.round(totalFare * 100) / 100,
          average_trip_distance: completedTrips.length > 0 ? Math.round((totalDistance / completedTrips.length) * 100) / 100 : 0,
          average_fare_per_trip: completedTrips.length > 0 ? Math.round((totalFare / completedTrips.length) * 100) / 100 : 0,
        },
        filters_applied: { status, driverId, passengerId, start_date, end_date }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching trips",
      error: error.message
    });
  }
});

// Payment approval methods - delegate to paymentController
exports.getPendingPayments = getPendingPayments;
exports.approvePayment = approvePayment;
exports.rejectPayment = rejectPayment;