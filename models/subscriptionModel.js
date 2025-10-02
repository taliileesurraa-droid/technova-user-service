//models/subscriptionModel.js
const { sequelize } = require("../config/dbconfig");
const { DataTypes } = require("sequelize");

const Subscription = sequelize.define(
  "Subscription",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    contract_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    passenger_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    amount_paid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },    
  status: {
    type: DataTypes.ENUM("PENDING", "ACTIVE", "PARTIAL", "EXPIRED", "CANCELLED"),
    defaultValue: "PENDING",
  },
  calculated_fare: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "JSON string containing fare calculation details"
  },
  },
  {
    tableName: "subscriptions",
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = Subscription;
