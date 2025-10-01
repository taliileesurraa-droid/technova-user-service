const models = require('../models').models;
const { Op } = require('sequelize');

/**
 * Create a new dispute/complaint
 * POST /disputes
 */
exports.createDispute = async (req, res) => {
  try {
    const {
      type,
      category,
      priority,
      title,
      description,
      respondentType,
      respondentId,
      rideId,
      attachments,
      tags
    } = req.body;

    // Get user info from auth middleware
    const userType = req.user.type; // 'passenger' or 'driver'
    const userId = req.user.id;

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required'
      });
    }

    // Validate category
    const validCategories = [
      'ride_issue', 'payment_issue', 'driver_behavior', 
      'passenger_behavior', 'app_technical', 'billing', 
      'safety_concern', 'other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Create dispute
    const dispute = await models.Dispute.create({
      type: type || 'complaint',
      category,
      priority: priority || 'medium',
      title,
      description,
      complainantType: userType,
      complainantId: userId,
      respondentType: respondentType || null,
      respondentId: respondentId || null,
      rideId: rideId || null,
      attachments: attachments || [],
      tags: tags || []
    });

    // Fetch the created dispute with associations
    const createdDispute = await models.Dispute.findByPk(dispute.id, {
      include: [
        {
          model: userType === 'passenger' ? models.Passenger : models.Driver,
          as: `complainant${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
          attributes: ['id', 'name', 'phone', 'email']
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Dispute created successfully',
      dispute: createdDispute
    });
  } catch (error) {
    console.error('Create dispute error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's disputes
 * GET /disputes
 */
exports.getUserDisputes = async (req, res) => {
  try {
    const userType = req.user.type;
    const userId = req.user.id;
    const { page = 1, limit = 10, status, category, type } = req.query;

    // Build where clause
    const whereClause = {
      complainantType: userType,
      complainantId: userId
    };

    if (status) whereClause.status = status;
    if (category) whereClause.category = category;
    if (type) whereClause.type = type;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Get disputes with pagination
    const { count, rows: disputes } = await models.Dispute.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: models.DisputeReply,
          as: 'replies',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [
            {
              model: models.Admin,
              as: 'replierAdmin',
              attributes: ['id', 'name', 'email']
            }
          ]
        },
        {
          model: models.Admin,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email']
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
    console.error('Get user disputes error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get specific dispute details
 * GET /disputes/:id
 */
exports.getDisputeDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userType = req.user.type;
    const userId = req.user.id;

    const dispute = await models.Dispute.findOne({
      where: {
        id,
        complainantType: userType,
        complainantId: userId
      },
      include: [
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
        },
        {
          model: models.Admin,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email']
        },
        {
          model: userType === 'passenger' ? models.Passenger : models.Driver,
          as: `complainant${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
          attributes: ['id', 'name', 'phone', 'email']
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
 * Add reply to dispute
 * POST /disputes/:id/replies
 */
exports.addDisputeReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments } = req.body;
    const userType = req.user.type;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Check if dispute exists and belongs to user
    const dispute = await models.Dispute.findOne({
      where: {
        id,
        complainantType: userType,
        complainantId: userId
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    // Create reply
    const reply = await models.DisputeReply.create({
      disputeId: id,
      replierType: userType,
      replierId: userId,
      message,
      attachments: attachments || []
    });

    // Fetch reply with associations
    const createdReply = await models.DisputeReply.findByPk(reply.id, {
      include: [
        {
          model: userType === 'passenger' ? models.Passenger : models.Driver,
          as: `replier${userType.charAt(0).toUpperCase() + userType.slice(1)}`,
          attributes: ['id', 'name', 'phone']
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      reply: createdReply
    });
  } catch (error) {
    console.error('Add dispute reply error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update dispute status (user can only close their own disputes)
 * PATCH /disputes/:id/status
 */
exports.updateDisputeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userType = req.user.type;
    const userId = req.user.id;

    // Users can only close their own disputes
    if (status !== 'closed') {
      return res.status(403).json({
        success: false,
        message: 'You can only close your own disputes'
      });
    }

    const dispute = await models.Dispute.findOne({
      where: {
        id,
        complainantType: userType,
        complainantId: userId
      }
    });

    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    // Update status
    await dispute.update({ status: 'closed' });

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