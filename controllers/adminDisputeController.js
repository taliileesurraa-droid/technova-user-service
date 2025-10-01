const models = require('../models').models;
const { Op } = require('sequelize');

/**
 * Get all disputes (admin view)
 * GET /admin/disputes
 */
exports.getAllDisputes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      type,
      priority,
      assignedAdminId,
      complainantType,
      search
    } = req.query;

    // Build where clause
    const whereClause = {};

    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    if (type) whereClause.type = type;
    if (priority) whereClause.priority = priority;
    if (assignedAdminId) whereClause.assignedAdminId = assignedAdminId;
    if (complainantType) whereClause.complainantType = complainantType;

    // Search functionality
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get disputes with pagination
    const { count, rows: disputes } = await models.Dispute.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.Passenger,
          as: 'complainantPassenger',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Driver,
          as: 'complainantDriver',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Passenger,
          as: 'respondentPassenger',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Driver,
          as: 'respondentDriver',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Admin,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email']
        },
        {
          model: models.DisputeReply,
          as: 'replies',
          limit: 1,
          order: [['createdAt', 'DESC']]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      disputes,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get all disputes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get dispute details (admin view)
 * GET /admin/disputes/:id
 */
exports.getDisputeDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const dispute = await models.Dispute.findByPk(id, {
      include: [
        {
          model: models.Passenger,
          as: 'complainantPassenger',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Driver,
          as: 'complainantDriver',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Passenger,
          as: 'respondentPassenger',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Driver,
          as: 'respondentDriver',
          attributes: ['id', 'name', 'phone', 'email']
        },
        {
          model: models.Admin,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email']
        },
        {
          model: models.DisputeReply,
          as: 'replies',
          order: [['createdAt', 'ASC']],
          include: [
            {
              model: models.Admin,
              as: 'replierAdmin',
              attributes: ['id', 'name', 'email']
            },
            {
              model: models.Passenger,
              as: 'replierPassenger',
              attributes: ['id', 'name', 'phone']
            },
            {
              model: models.Driver,
              as: 'replierDriver',
              attributes: ['id', 'name', 'phone']
            }
          ]
        }
      ]
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    return res.status(200).json({
      success: true,
      dispute
    });
  } catch (error) {
    console.error('Get dispute details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Assign dispute to admin
 * PATCH /admin/disputes/:id/assign
 */
exports.assignDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedAdminId } = req.body;
    const currentAdminId = req.user.id;

    if (!assignedAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Assigned admin ID is required'
      });
    }

    // Verify the assigned admin exists
    const assignedAdmin = await models.Admin.findByPk(assignedAdminId);
    if (!assignedAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Assigned admin not found'
      });
    }

    const dispute = await models.Dispute.findByPk(id);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    // Update assignment
    await dispute.update({ assignedAdminId });

    // Create admin reply about assignment
    await models.DisputeReply.create({
      disputeId: id,
      replierType: 'admin',
      replierId: currentAdminId,
      message: `Dispute assigned to ${assignedAdmin.name}`,
      internalNotes: `Assigned by admin ID: ${currentAdminId}`
    });

    return res.status(200).json({
      success: true,
      message: 'Dispute assigned successfully',
      dispute
    });
  } catch (error) {
    console.error('Assign dispute error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update dispute status (admin)
 * PATCH /admin/disputes/:id/status
 */
exports.updateDisputeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution, priority } = req.body;
    const adminId = req.user.id;

    const dispute = await models.Dispute.findByPk(id);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    // Prepare update data
    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (resolution) updateData.resolution = resolution;
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    // Update dispute
    await dispute.update(updateData);

    // Create admin reply about status change
    let message = `Dispute status updated to ${status}`;
    if (priority) message += `, priority set to ${priority}`;
    if (resolution) message += `, resolution provided`;

    await models.DisputeReply.create({
      disputeId: id,
      replierType: 'admin',
      replierId: adminId,
      message,
      statusChange: status,
      priorityChange: priority,
      internalNotes: `Status updated by admin ID: ${adminId}`
    });

    return res.status(200).json({
      success: true,
      message: 'Dispute status updated successfully',
      dispute
    });
  } catch (error) {
    console.error('Update dispute status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Add admin reply to dispute
 * POST /admin/disputes/:id/replies
 */
exports.addAdminReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, internalNotes, statusChange, priorityChange, attachments } = req.body;
    const adminId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const dispute = await models.Dispute.findByPk(id);
    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    // Create admin reply
    const reply = await models.DisputeReply.create({
      disputeId: id,
      replierType: 'admin',
      replierId: adminId,
      message,
      internalNotes: internalNotes || null,
      statusChange: statusChange || null,
      priorityChange: priorityChange || null,
      attachments: attachments || []
    });

    // Update dispute if status/priority changed
    const updateData = {};
    if (statusChange) updateData.status = statusChange;
    if (priorityChange) updateData.priority = priorityChange;
    if (statusChange === 'resolved' || statusChange === 'closed') {
      updateData.resolvedAt = new Date();
    }

    if (Object.keys(updateData).length > 0) {
      await dispute.update(updateData);
    }

    // Fetch reply with admin info
    const createdReply = await models.DisputeReply.findByPk(reply.id, {
      include: [
        {
          model: models.Admin,
          as: 'replierAdmin',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      reply: createdReply
    });
  } catch (error) {
    console.error('Add admin reply error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get dispute statistics
 * GET /admin/disputes/stats
 */
exports.getDisputeStats = async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get basic counts
    const totalDisputes = await models.Dispute.count();
    const openDisputes = await models.Dispute.count({ where: { status: 'open' } });
    const inProgressDisputes = await models.Dispute.count({ where: { status: 'in_progress' } });
    const resolvedDisputes = await models.Dispute.count({ where: { status: 'resolved' } });
    const closedDisputes = await models.Dispute.count({ where: { status: 'closed' } });

    // Get recent disputes
    const recentDisputes = await models.Dispute.count({
      where: {
        createdAt: {
          [Op.gte]: startDate
        }
      }
    });

    // Get disputes by category
    const disputesByCategory = await models.Dispute.findAll({
      attributes: [
        'category',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
      ],
      group: ['category'],
      raw: true
    });

    // Get disputes by priority
    const disputesByPriority = await models.Dispute.findAll({
      attributes: [
        'priority',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
      ],
      group: ['priority'],
      raw: true
    });

    // Get disputes by complainant type
    const disputesByComplainant = await models.Dispute.findAll({
      attributes: [
        'complainantType',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
      ],
      group: ['complainantType'],
      raw: true
    });

    return res.status(200).json({
      success: true,
      stats: {
        total: totalDisputes,
        open: openDisputes,
        inProgress: inProgressDisputes,
        resolved: resolvedDisputes,
        closed: closedDisputes,
        recent: recentDisputes,
        byCategory: disputesByCategory,
        byPriority: disputesByPriority,
        byComplainant: disputesByComplainant
      }
    });
  } catch (error) {
    console.error('Get dispute stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};