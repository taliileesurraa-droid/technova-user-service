const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/dbconfig");

const Trip = sequelize.define("Trip", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  contract_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  subscription_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  passenger_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  driver_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  pickup_location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dropoff_location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  pickup_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  pickup_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  dropoff_latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  dropoff_longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  distance_km: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
  },
  fare_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("SCHEDULED", "PICKUP_CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"),
    defaultValue: "SCHEDULED",
  },
  scheduled_pickup_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actual_pickup_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  actual_dropoff_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pickup_confirmed_by_passenger: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  trip_ended_by_passenger: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "trips",
  timestamps: true,
});

module.exports = Trip;