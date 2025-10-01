const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Dispute = sequelize.define('Dispute', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    type: {
      type: DataTypes.ENUM('complaint', 'dispute', 'feedback'),
      allowNull: false,
      defaultValue: 'complaint'
    },
    category: {
      type: DataTypes.ENUM(
        'ride_issue',
        'payment_issue', 
        'driver_behavior',
        'passenger_behavior',
        'app_technical',
        'billing',
        'safety_concern',
        'other'
      ),
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    status: {
      type: DataTypes.ENUM('open', 'in_progress', 'resolved', 'closed', 'rejected'),
      allowNull: false,
      defaultValue: 'open'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // Who filed the complaint/dispute
    complainantType: {
      type: DataTypes.ENUM('passenger', 'driver'),
      allowNull: false
    },
    complainantId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // Who is being complained about (optional)
    respondentType: {
      type: DataTypes.ENUM('passenger', 'driver'),
      allowNull: true
    },
    respondentId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Related ride (optional)
    rideId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Admin handling the case
    assignedAdminId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Resolution details
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Additional metadata
    attachments: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    }
  }, {
    tableName: 'disputes',
    timestamps: true,
    paranoid: true // Soft delete
    // Indexes are created via migration script
  });

  return Dispute;
};