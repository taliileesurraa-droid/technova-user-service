const { Trip, Subscription } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { getUserInfo } = require("../utils/tokenHelper");

// PATCH /trip/:id/pickup - Confirm pickup by passenger
exports.confirmPickup = asyncHandler(async (req, res) => {
  const tripId = req.params.id;
  const { notes } = req.body;

  try {
    const trip = await Trip.findByPk(tripId);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found"
      });
    }

    // Authorization check - only passenger can confirm pickup
    if (req.user.type === "passenger" && req.user.id !== trip.passenger_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied - only the passenger can confirm pickup"
      });
    }

    // Check if trip is in correct state
    if (trip.status !== "SCHEDULED") {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm pickup. Trip status is ${trip.status}`
      });
    }

    // Update trip with pickup confirmation
    await Trip.update({
      status: "PICKUP_CONFIRMED",
      actual_pickup_time: new Date(),
      pickup_confirmed_by_passenger: true,
      notes: notes || trip.notes
    }, {
      where: { id: tripId }
    });

    // Get updated trip with passenger info
    const updatedTrip = await Trip.findByPk(tripId);
    const passengerInfo = await getUserInfo(req, trip.passenger_id, 'passenger');
    const driverInfo = await getUserInfo(req, trip.driver_id, 'driver');

    res.json({
      success: true,
      message: "Pickup confirmed successfully",
      data: {
        trip: {
          ...updatedTrip.toJSON(),
          passenger_name: passengerInfo?.name || null,
          passenger_phone: passengerInfo?.phone || null,
          passenger_email: passengerInfo?.email || null,
          driver_name: driverInfo?.name || null,
          driver_phone: driverInfo?.phone || null,
          vehicle_info: driverInfo?.vehicle_info || null,
        },
        confirmed_at: updatedTrip.actual_pickup_time,
        confirmed_by: passengerInfo?.name || req.user.id
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error confirming pickup",
      error: error.message
    });
  }
});

// PATCH /trip/:id/dropoff - Confirm dropoff by passenger
exports.confirmDropoff = asyncHandler(async (req, res) => {
  const tripId = req.params.id;
  const { notes, rating } = req.body;

  try {
    const trip = await Trip.findByPk(tripId);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found"
      });
    }

    // Authorization check - only passenger can confirm dropoff
    if (req.user.type === "passenger" && req.user.id !== trip.passenger_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied - only the passenger can confirm dropoff"
      });
    }

    // Check if trip is in correct state
    if (!["PICKUP_CONFIRMED", "IN_PROGRESS"].includes(trip.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm dropoff. Trip status is ${trip.status}. Pickup must be confirmed first.`
      });
    }

    // Calculate trip duration
    const pickupTime = trip.actual_pickup_time || trip.scheduled_pickup_time;
    const dropoffTime = new Date();
    const durationMinutes = pickupTime ? Math.round((dropoffTime - new Date(pickupTime)) / (1000 * 60)) : null;

    // Update trip with dropoff confirmation
    await Trip.update({
      status: "COMPLETED",
      actual_dropoff_time: dropoffTime,
      trip_ended_by_passenger: true,
      notes: notes || trip.notes,
      rating: rating || null
    }, {
      where: { id: tripId }
    });

    // Get updated trip with user info
    const updatedTrip = await Trip.findByPk(tripId);
    const passengerInfo = await getUserInfo(req, trip.passenger_id, 'passenger');
    const driverInfo = await getUserInfo(req, trip.driver_id, 'driver');

    res.json({
      success: true,
      message: "Trip completed successfully",
      data: {
        trip: {
          ...updatedTrip.toJSON(),
          passenger_name: passengerInfo?.name || null,
          passenger_phone: passengerInfo?.phone || null,
          passenger_email: passengerInfo?.email || null,
          driver_name: driverInfo?.name || null,
          driver_phone: driverInfo?.phone || null,
          vehicle_info: driverInfo?.vehicle_info || null,
          trip_duration_minutes: durationMinutes,
        },
        completed_at: updatedTrip.actual_dropoff_time,
        completed_by: passengerInfo?.name || req.user.id,
        trip_summary: {
          pickup_time: updatedTrip.actual_pickup_time,
          dropoff_time: updatedTrip.actual_dropoff_time,
          duration_minutes: durationMinutes,
          distance_km: updatedTrip.distance_km,
          fare_amount: updatedTrip.fare_amount,
          rating: updatedTrip.rating
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error confirming dropoff",
      error: error.message
    });
  }
});

// GET /trip/:id - Get trip details with passenger and driver info
exports.getTripDetails = asyncHandler(async (req, res) => {
  const tripId = req.params.id;

  try {
    const trip = await Trip.findByPk(tripId);
    
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found"
      });
    }

    // Authorization check - passenger or driver can view trip details
    if (req.user.type === "passenger" && req.user.id !== trip.passenger_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }
    
    if (req.user.type === "driver" && req.user.id !== trip.driver_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Get user information
    const passengerInfo = await getUserInfo(req, trip.passenger_id, 'passenger');
    const driverInfo = await getUserInfo(req, trip.driver_id, 'driver');

    // Calculate trip duration if both times are available
    let durationMinutes = null;
    if (trip.actual_pickup_time && trip.actual_dropoff_time) {
      durationMinutes = Math.round((new Date(trip.actual_dropoff_time) - new Date(trip.actual_pickup_time)) / (1000 * 60));
    }

    res.json({
      success: true,
      data: {
        trip: {
          ...trip.toJSON(),
          passenger_name: passengerInfo?.name || null,
          passenger_phone: passengerInfo?.phone || null,
          passenger_email: passengerInfo?.email || null,
          driver_name: driverInfo?.name || null,
          driver_phone: driverInfo?.phone || null,
          driver_email: driverInfo?.email || null,
          vehicle_info: driverInfo?.vehicle_info || null,
          trip_duration_minutes: durationMinutes,
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching trip details",
      error: error.message
    });
  }
});

// GET /passenger/:id/driver - Get assigned driver information for passenger
exports.getAssignedDriver = asyncHandler(async (req, res) => {
  const passengerId = req.params.id;

  // Authorization check - passengers can only view their own driver info
  if (req.user.type === "passenger" && req.user.id !== passengerId) {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }

  try {
    // Find active subscription for passenger
    const activeSubscription = await Subscription.findOne({
      where: {
        passenger_id: passengerId,
        status: "ACTIVE",
        driver_id: { [require("sequelize").Op.ne]: null }
      },
      order: [['createdAt', 'DESC']]
    });

    if (!activeSubscription || !activeSubscription.driver_id) {
      return res.status(404).json({
        success: false,
        message: "No active driver assigned to this passenger"
      });
    }

    // Get driver information
    const driverInfo = await getUserInfo(req, activeSubscription.driver_id, 'driver');
    const passengerInfo = await getUserInfo(req, passengerId, 'passenger');

    res.json({
      success: true,
      data: {
        passenger_id: passengerId,
        passenger_name: passengerInfo?.name || null,
        assigned_driver: {
          driver_id: activeSubscription.driver_id,
          driver_name: driverInfo?.name || activeSubscription.driver_name || null,
          driver_phone: driverInfo?.phone || activeSubscription.driver_phone || null,
          driver_email: driverInfo?.email || activeSubscription.driver_email || null,
          vehicle_info: driverInfo?.vehicle_info || activeSubscription.vehicle_info || null,
        },
        subscription: {
          id: activeSubscription.id,
          contract_type: activeSubscription.contract_type,
          pickup_location: activeSubscription.pickup_location,
          dropoff_location: activeSubscription.dropoff_location,
          start_date: activeSubscription.start_date,
          end_date: activeSubscription.end_date,
          status: activeSubscription.status
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching assigned driver information",
      error: error.message
    });
  }
});