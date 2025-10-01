//models/paymentModel.js
const { sequelize } = require("../config/dbconfig");
const { DataTypes } = require("sequelize");

const Payment = sequelize.define(
  "Payment",
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
    payment_method: {
      type: DataTypes.ENUM("BANK_TRANSFER", "MOBILE_MONEY", "CASH", "CARD"),
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    receipt_image: {
      type: DataTypes.STRING(255),
    },
    transaction_reference: {
      type: DataTypes.STRING,
    },
    status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED", "PENDING"),
      defaultValue: "PENDING",
    },
  },
  {
    tableName: "contract_payments",
    timestamps: true,
    updatedAt: false,
  }
);

module.exports = Payment;
