const { Subscription } = require("../models/indexModel");
const { asyncHandler } = require("../middleware/errorHandler");
const { getPassengerById } = require("../utils/userService");
const { Op } = require("sequelize");

// GET /driver/:id/assignments - Get driver's assigned subscriptions
exports.getDriverAssignments = asyncHandler(async (req, res) => {
  const driverId = req.params.id;

  // Check if user can access this driver's data
  if (req.user.type === "driver" && req.user.id !== driverId) {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }

  try {
    const assignments = await Subscription.findAll({
      where: {
        driver_id: driverId,
        status: ["ACTIVE", "PENDING"]
      },
      order: [['createdAt', 'DESC']],
    });

    // Get passenger information for enrichment
    const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
    const uniquePassengerIds = [...new Set(assignments.map(s => s.passenger_id).filter(Boolean))];
    
    const passengerInfoMap = new Map();
    await Promise.all(uniquePassengerIds.map(async (pid) => {
      try {
        const info = await getPassengerById(pid, authHeader);
        if (info) passengerInfoMap.set(pid, info);
      } catch (_) {}
    }));

    // Enrich assignments with passenger information
    const enrichedAssignments = assignments.map(assignment => {
      const assignmentData = assignment.toJSON();
      const passengerInfo = passengerInfoMap.get(assignment.passenger_id);
      
      return {
        ...assignmentData,
        passenger_name: passengerInfo?.name || null,
        passenger_phone: passengerInfo?.phone || null,
        passenger_email: passengerInfo?.email || null,
      };
    });

    // Separate by status
    const activeAssignments = enrichedAssignments.filter(a => a.status === "ACTIVE");
    const pendingAssignments = enrichedAssignments.filter(a => a.status === "PENDING");

    res.json({
      success: true,
      data: {
        active_assignments: activeAssignments,
        pending_assignments: pendingAssignments,
        total_assignments: enrichedAssignments.length,
        active_count: activeAssignments.length,
        pending_count: pendingAssignments.length,
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching driver assignments",
      error: error.message
    });
  }
});

// GET /driver/:id/schedule - Get driver's schedule and subscription details
exports.getDriverSchedule = asyncHandler(async (req, res) => {
  const driverId = req.params.id;
  const { date, contract_type } = req.query;

  // Check if user can access this driver's data
  if (req.user.type === "driver" && req.user.id !== driverId) {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }

  try {
    let whereClause = {
      driver_id: driverId,
      status: "ACTIVE"
    };

    // Filter by contract type if provided
    if (contract_type) {
      whereClause.contract_type = contract_type;
    }

    // Filter by date range if provided
    if (date) {
      const targetDate = new Date(date);
      whereClause.start_date = {
        [Op.lte]: targetDate
      };
      whereClause.end_date = {
        [Op.gte]: targetDate
      };
    }

    const scheduleSubscriptions = await Subscription.findAll({
      where: whereClause,
      order: [['start_date', 'ASC'], ['createdAt', 'DESC']],
    });

    // Get passenger information for enrichment
    const authHeader = req.headers && req.headers.authorization ? { headers: { Authorization: req.headers.authorization } } : {};
    const uniquePassengerIds = [...new Set(scheduleSubscriptions.map(s => s.passenger_id).filter(Boolean))];
    
    const passengerInfoMap = new Map();
    await Promise.all(uniquePassengerIds.map(async (pid) => {
      try {
        const info = await getPassengerById(pid, authHeader);
        if (info) passengerInfoMap.set(pid, info);
      } catch (_) {}
    }));

    // Enrich schedule with passenger information and organize by contract type
    const enrichedSchedule = scheduleSubscriptions.map(subscription => {
      const subData = subscription.toJSON();
      const passengerInfo = passengerInfoMap.get(subscription.passenger_id);
      
      return {
        ...subData,
        passenger_name: passengerInfo?.name || null,
        passenger_phone: passengerInfo?.phone || null,
        passenger_email: passengerInfo?.email || null,
      };
    });

    // Group by contract type for better organization
    const scheduleByType = enrichedSchedule.reduce((acc, subscription) => {
      const type = subscription.contract_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(subscription);
      return acc;
    }, {});

    // Calculate schedule statistics
    const stats = {
      total_active_subscriptions: enrichedSchedule.length,
      daily_subscriptions: scheduleByType.DAILY?.length || 0,
      weekly_subscriptions: scheduleByType.WEEKLY?.length || 0,
      monthly_subscriptions: scheduleByType.MONTHLY?.length || 0,
      yearly_subscriptions: scheduleByType.YEARLY?.length || 0,
    };

    res.json({
      success: true,
      data: {
        schedule: enrichedSchedule,
        schedule_by_type: scheduleByType,
        statistics: stats,
        filters_applied: { date, contract_type }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching driver schedule",
      error: error.message
    });
  }
});

// GET /driver/:id/earnings - Get driver's earnings summary
exports.getDriverEarnings = asyncHandler(async (req, res) => {
  const driverId = req.params.id;
  const { start_date, end_date } = req.query;

  // Check if user can access this driver's data
  if (req.user.type === "driver" && req.user.id !== driverId) {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }

  try {
    let whereClause = {
      driver_id: driverId,
      payment_status: "PAID"
    };

    // Filter by date range if provided
    if (start_date || end_date) {
      whereClause.createdAt = {};
      if (start_date) {
        whereClause.createdAt[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.createdAt[Op.lte] = new Date(end_date);
      }
    }

    const paidSubscriptions = await Subscription.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });

    // Calculate earnings
    const totalEarnings = paidSubscriptions.reduce((sum, sub) => {
      return sum + parseFloat(sub.final_fare || 0);
    }, 0);

    // Group by contract type
    const earningsByType = paidSubscriptions.reduce((acc, sub) => {
      const type = sub.contract_type;
      if (!acc[type]) {
        acc[type] = { count: 0, total: 0 };
      }
      acc[type].count += 1;
      acc[type].total += parseFloat(sub.final_fare || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total_earnings: Math.round(totalEarnings * 100) / 100,
        total_subscriptions: paidSubscriptions.length,
        earnings_by_type: earningsByType,
        date_range: { start_date, end_date },
        subscriptions: paidSubscriptions.map(sub => ({
          id: sub.id,
          contract_type: sub.contract_type,
          final_fare: sub.final_fare,
          pickup_location: sub.pickup_location,
          dropoff_location: sub.dropoff_location,
          start_date: sub.start_date,
          end_date: sub.end_date,
          created_at: sub.createdAt,
        }))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching driver earnings",
      error: error.message
    });
  }
});