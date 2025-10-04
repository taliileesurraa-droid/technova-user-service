#!/usr/bin/env node

const { migrateContractTypes } = require("../utils/migrateContractTypes.js");

const runMigration = async () => {
  try {
    console.log("🚀 Starting contract type migration...");
    await migrateContractTypes();
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
