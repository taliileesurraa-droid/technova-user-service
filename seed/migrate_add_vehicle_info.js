require('dotenv').config();
const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

async function migrateVehicleInfo() {
  try {
    console.log('Starting vehicle info migration...');
    
    // Add vehicleType column
    try {
      await sequelize.getQueryInterface().addColumn('drivers', 'vehicle_type', {
        type: DataTypes.ENUM('mini', 'sedan', 'van'),
        allowNull: true
      });
      console.log('Added vehicle_type column to drivers table');
    } catch (error) {
      if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
        console.log('vehicle_type column already exists in drivers table');
      } else {
        console.error('Error adding vehicle_type to drivers:', error.message);
      }
    }

    // Add carName column
    try {
      await sequelize.getQueryInterface().addColumn('drivers', 'car_name', {
        type: DataTypes.STRING,
        allowNull: true
      });
      console.log('Added car_name column to drivers table');
    } catch (error) {
      if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
        console.log('car_name column already exists in drivers table');
      } else {
        console.error('Error adding car_name to drivers:', error.message);
      }
    }

    // Add driverStatus column
    try {
      await sequelize.getQueryInterface().addColumn('drivers', 'driver_status', {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'inactive'
      });
      console.log('Added driver_status column to drivers table');
      
      // Update existing drivers to have 'active' status if they are approved and verified
      try {
        const [results] = await sequelize.query(`
          UPDATE drivers 
          SET driver_status = 'active' 
          WHERE status = 'approved' AND verification = true
        `);
        console.log(`Updated ${results.affectedRows || 0} existing drivers to 'active' driver_status`);
      } catch (updateError) {
        console.error('Error updating existing drivers driver_status:', updateError.message);
      }
    } catch (error) {
      if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
        console.log('driver_status column already exists in drivers table');
      } else {
        console.error('Error adding driver_status to drivers:', error.message);
      }
    }

    console.log('Vehicle info migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Vehicle info migration failed:', error);
    process.exit(1);
  }
}

migrateVehicleInfo();
