const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DisputeReply = sequelize.define('DisputeReply', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    disputeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'disputes',
        key: 'id'
      }
    },
    // Who is replying (admin, passenger, or driver)
    replierType: {
      type: DataTypes.ENUM('admin', 'passenger', 'driver'),
      allowNull: false
    },
    replierId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // If this reply changes the dispute status
    statusChange: {
      type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed', 'rejected'),
      allowNull: true
    },
    // If this reply changes the priority
    priorityChange: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: true
    },
    // If this reply assigns the dispute to an admin
    assignedToAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Internal notes (only visible to admins)
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Attachments
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    }
  }, {
    tableName: 'dispute_replies',
    timestamps: true
    // Indexes are created via migration script
  });

  return DisputeReply;
};