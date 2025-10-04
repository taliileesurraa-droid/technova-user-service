const { sequelize } = require("../config/dbconfig");

// Import models
const Contract = require("./contractModel");
const Discount = require("./discountModel");
const Payment = require("./paymentModel");
const Subscription = require("./subscriptionModel");
const RideSchedule = require("./rideScheduleModel");
const Trip = require("./tripModel");
const TripSchedule = require("./tripScheduleModel");
const Pricing = require("./pricingModel");
const ContractSettings = require("./contractSettingsModel");

/**
 * ========================
 * Define Associations
 * ========================
**/

// Contract ↔ Discount (1:1, optional)
Contract.belongsTo(Discount, {
  foreignKey: "discount_id",
  as: "discount",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
Discount.hasMany(Contract, {
  foreignKey: "discount_id",
  as: "contractsWithDiscount",
});

// Contract ↔ Payment (1:N)
Contract.hasMany(Payment, {
  foreignKey: "contract_id",
  as: "payments",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
Payment.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Subscription ↔ Payment (1:N)
Subscription.hasMany(Payment, {
  foreignKey: "subscription_id",
  as: "payments",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
Payment.belongsTo(Subscription, {
  foreignKey: "subscription_id",
  as: "subscription",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

// Contract ↔ Subscription (1:N)
Contract.hasMany(Subscription, {
  foreignKey: "contract_id",
  as: "subscriptions",
});
Subscription.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

// Contract ↔ RideSchedule (1:N)
Contract.hasMany(RideSchedule, {
  foreignKey: "contract_id",
  as: "ride_schedules",
});
RideSchedule.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
});

// Trip ↔ Contract (N:1)
Trip.belongsTo(Contract, {
  foreignKey: "contract_id",
  as: "contract",
  onDelete: "RESTRICT",  // or "CASCADE" if you want to delete trips with contract
  onUpdate: "CASCADE",
});

Contract.hasMany(Trip, {
  foreignKey: "contract_id",
  as: "trips",
});

// Trip ↔ Subscription (N:1)
Trip.belongsTo(Subscription, {
  foreignKey: "subscription_id",
  as: "subscription",
});
Subscription.hasMany(Trip, {
  foreignKey: "subscription_id",
  as: "trips",
});

// Trip ↔ TripSchedule (1:1)
Trip.hasOne(TripSchedule, {
  foreignKey: "trip_id",
  as: "schedule",
});
TripSchedule.belongsTo(Trip, {
  foreignKey: "trip_id",
  as: "trip",
});

// Payment ↔ Passenger (external reference → user service)
// Subscription ↔ Passenger (external reference → user service)
// RideSchedule ↔ Driver (external reference → driver service)
// Trip ↔ Passenger (external reference → user service)
// Trip ↔ Driver (external reference → driver service)
// 👉 note: not hard foreign keys here, just IDs stored.

/**
 * ========================
 * Database Sync Function
 * ========================
**/

const syncDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established successfully.");

    // Sync in correct order to respect foreign key constraints
    await Discount.sync({ alter: true });
    console.log("✅ Discount table synced successfully!");

    await Contract.sync({ alter: true });
    console.log("✅ Contract table synced successfully!");

    await Subscription.sync({ alter: true });
    console.log("✅ Subscription table synced successfully!");

    await Payment.sync({ alter: true });
    console.log("✅ Payment table synced successfully!");

    await RideSchedule.sync({ alter: true });
    console.log("✅ RideSchedule table synced successfully!");

    await Trip.sync({ alter: true });
    console.log("✅ Trip table synced successfully!");

    await TripSchedule.sync({ alter: true });
    console.log("✅ TripSchedule table synced successfully!");

    await Pricing.sync({ alter: true });
    console.log("✅ Pricing table synced successfully!");

    await ContractSettings.sync({ alter: true });
    console.log("✅ ContractSettings table synced successfully!");

    console.log("✅ All Contract Service tables synced successfully!");
  } catch (error) {
    console.error("❌ Error syncing database:", error);
    throw error;
  }
};

// Export models and sync function
module.exports = {
  sequelize,
  Discount,
  Contract,
  Payment,
  Subscription,
  RideSchedule,
  Trip,
  TripSchedule,
  Pricing,
  ContractSettings,
  syncDB,
};
