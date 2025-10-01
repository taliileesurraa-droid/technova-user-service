const { sequelize } = require('../config/database');

async function migrateDisputeTables() {
  try {
    console.log('Starting dispute tables migration...');

    // Create disputes table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('complaint', 'dispute', 'feedback') NOT NULL DEFAULT 'complaint',
        category ENUM('ride_issue', 'payment_issue', 'driver_behavior', 'passenger_behavior', 'app_technical', 'billing', 'safety_concern', 'other') NOT NULL,
        priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'resolved', 'closed', 'rejected') NOT NULL DEFAULT 'open',
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        complainantType ENUM('passenger', 'driver') NOT NULL,
        complainantId INT NOT NULL,
        respondentType ENUM('passenger', 'driver') NULL,
        respondentId INT NULL,
        rideId INT NULL,
        assignedAdminId INT NULL,
        resolution TEXT NULL,
        resolvedAt DATETIME NULL,
        attachments JSON NULL DEFAULT ('[]'),
        tags JSON NULL DEFAULT ('[]'),
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deletedAt DATETIME NULL,
        INDEX idx_disputes_complainant (complainantType, complainantId),
        INDEX idx_disputes_respondent (respondentType, respondentId),
        INDEX idx_disputes_status (status),
        INDEX idx_disputes_priority (priority),
        INDEX idx_disputes_category (category),
        INDEX idx_disputes_assigned_admin (assignedAdminId),
        INDEX idx_disputes_created_at (createdAt),
        INDEX idx_disputes_deleted_at (deletedAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Disputes table created successfully');

    // Create dispute_replies table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS dispute_replies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        disputeId INT NOT NULL,
        replierType ENUM('admin', 'passenger', 'driver') NOT NULL,
        replierId INT NOT NULL,
        message TEXT NOT NULL,
        statusChange ENUM('open', 'in_progress', 'resolved', 'closed', 'rejected') NULL,
        priorityChange ENUM('low', 'medium', 'high', 'urgent') NULL,
        assignedToAdminId INT NULL,
        internalNotes TEXT NULL,
        attachments JSON NULL DEFAULT ('[]'),
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dispute_replies_dispute (disputeId),
        INDEX idx_dispute_replies_replier (replierType, replierId),
        INDEX idx_dispute_replies_created_at (createdAt),
        FOREIGN KEY (disputeId) REFERENCES disputes(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Dispute replies table created successfully');

    console.log('🎉 All dispute tables migrated successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateDisputeTables()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateDisputeTables;