const express = require("express");
const router = express.Router();
const { Trip, Contract, Subscription } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { authenticate, authorize } = require("../middleware/auth");
const { getPassengerById, getDriverById } = require("../utils/userService");

// Apply authentication to all routes
router.use(authenticate);

// CREATE - Create Trip
const createTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.create(req.body);
  res.status(201).json({ success: true, data: trip });
});

// READ all - Admin sees all, Driver/Passenger see only their own
const getTrips = asyncHandler(async (req, res) => {
  let whereClause = {};

  if (req.user.type === "driver") {
    whereClause.driver_id = req.user.id;
  } else if (req.user.type === "passenger") {
    whereClause.passenger_id = req.user.id;
  }

  const trips = await Trip.findAll({
    where: whereClause,
    include: [
      {
        model: Contract,
        as: "contract",
        attributes: ["id", "contract_type", "pickup_location", "dropoff_location"]
      },
      {
        model: Subscription,
        as: "subscription",
        attributes: ["id", "status", "start_date", "end_date"]
      }
    ],
    order: [['createdAt', 'DESC']],
  });

  // Enrich with user information
  const uniquePassengerIds = [...new Set(trips.map(t => t.passenger_id).filter(Boolean))];
  const uniqueDriverIds = [...new Set(trips.map(t => t.driver_id).filter(Boolean))];
  const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
  
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

  const enrichedTrips = trips.map(trip => {
    const tripData = trip.toJSON();
    const passengerInfo = passengerInfoMap.get(trip.passenger_id);
    const driverInfo = driverInfoMap.get(trip.driver_id);
    
    return {
      ...tripData,
      passenger_name: passengerInfo?.name || null,
      passenger_phone: passengerInfo?.phone || null,
      passenger_email: passengerInfo?.email || null,
      driver_name: driverInfo?.name || null,
      driver_phone: driverInfo?.phone || null,
      driver_email: driverInfo?.email || null,
    };
  });

  res.json({ success: true, data: enrichedTrips });
});

// READ one
const getTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findByPk(req.params.id, {
    include: [
      {
        model: Contract,
        as: "contract"
      },
      {
        model: Subscription,
        as: "subscription"
      }
    ],
  });

  if (!trip) {
    return res.status(404).json({ success: false, message: "Trip not found" });
  }

  // Check access permissions
  if (req.user.type === "driver" && trip.driver_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  if (req.user.type === "passenger" && trip.passenger_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Enrich with user information
  const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
  const tripData = trip.toJSON();
  
  try {
    const [passengerInfo, driverInfo] = await Promise.all([
      getPassengerById(trip.passenger_id, authHeader).catch(() => null),
      getDriverById(trip.driver_id, authHeader).catch(() => null)
    ]);

    tripData.passenger_name = passengerInfo?.name || null;
    tripData.passenger_phone = passengerInfo?.phone || null;
    tripData.passenger_email = passengerInfo?.email || null;
    tripData.driver_name = driverInfo?.name || null;
    tripData.driver_phone = driverInfo?.phone || null;
    tripData.driver_email = driverInfo?.email || null;
  } catch (_) {}

  res.json({ success: true, data: tripData });
});

// UPDATE
const updateTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findByPk(req.params.id);
  
  if (!trip) {
    return res.status(404).json({ success: false, message: "Trip not found" });
  }

  // Check access permissions
  if (req.user.type === "driver" && trip.driver_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  if (req.user.type === "passenger" && trip.passenger_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  await trip.update(req.body);
  res.json({ success: true, message: "Trip updated", data: trip });
});

// DELETE
const deleteTrip = asyncHandler(async (req, res) => {
  const deleted = await Trip.destroy({ where: { id: req.params.id } });
  if (!deleted) {
    return res.status(404).json({ success: false, message: "Trip not found" });
  }
  res.json({ success: true, message: "Trip deleted" });
});

// Routes
router.post("/", authorize("admin"), createTrip);
router.get("/", authorize("admin", "driver", "passenger"), getTrips);
router.get("/:id", authorize("admin", "driver", "passenger"), getTrip);
router.put("/:id", authorize("admin", "driver", "passenger"), updateTrip);
router.delete("/:id", authorize("admin"), deleteTrip);

module.exports = router;