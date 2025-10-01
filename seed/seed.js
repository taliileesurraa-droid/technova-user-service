require('dotenv').config();
const { sequelize } = require('../config/database');
const { models } = require('../models');
const { hashPassword } = require('../utils/password');

async function run() {
try {
await sequelize.authenticate();
// Avoid altering schema during seeding to prevent join table PK conflicts
// Schema is created by the app on startup via sequelize.sync()

const permNames = [
'role:create','role:read','role:update','role:delete',
'permission:create','permission:read','permission:update','permission:delete',
'user:read','user:update','admin:create','admin:read','admin:update','admin:delete','driver:approve',
'driver:create','driver:read','driver:update','driver:delete','driver:documents:update','driver:documents:approve',
'passenger:read','passenger:update','passenger:delete',
'staff:create','staff:read','staff:update','staff:delete'
];
const permissions = [];
for (const name of permNames) {
const [perm] = await models.Permission.findOrCreate({ where: { name }, defaults: { name } });
permissions.push(perm);
}

const [superAdminRole] = await models.Role.findOrCreate({ where: { name: 'superadmin' }, defaults: { name: 'superadmin' } });

// Fix RolePermissions table structure if needed
const qi = sequelize.getQueryInterface();

// Check if RolePermissions table exists
const rolePermTableExists = await qi.showAllTables().then(tables => 
  tables.some(table => table.tableName === 'RolePermissions')
);

if (rolePermTableExists) {
  const rolePermDesc = await qi.describeTable('RolePermissions');
  const hasRolePermRoleId = rolePermDesc.RoleId || rolePermDesc.roleId || rolePermDesc.role_id;

  if (!hasRolePermRoleId) {
    try {
      await qi.addColumn('RolePermissions', 'RoleId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added RoleId column to RolePermissions');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('RoleId column already exists in RolePermissions, skipping...');
      } else {
        throw error;
      }
    }
  }
} else {
  console.log('RolePermissions table does not exist, skipping column checks...');
}

// Attach all permissions to superadmin
if (rolePermTableExists) {
  for (const perm of permissions) {
    await sequelize.query(`INSERT IGNORE INTO \`RolePermissions\` (\`RoleId\`, \`PermissionId\`) VALUES (?, ?)`, {
      replacements: [superAdminRole.id, perm.id],
    });
  }
} else {
  console.log('RolePermissions table does not exist, skipping permission assignments...');
}

const username = 'rootadmin';
const [admin] = await models.Admin.findOrCreate({
where: { username },
defaults: { fullName: 'Root Admin', username, password: await hashPassword('admin123'), email: 'admin@example.com' }
});

// Fix AdminRoles table structure if needed
const adminRoleTableExists = await qi.showAllTables().then(tables => 
  tables.some(table => table.tableName === 'AdminRoles')
);

if (adminRoleTableExists) {
  const adminRoleDesc = await qi.describeTable('AdminRoles');
  const hasAdminId = adminRoleDesc.AdminId || adminRoleDesc.adminId || adminRoleDesc.admin_id;
  const hasRoleId = adminRoleDesc.RoleId || adminRoleDesc.roleId || adminRoleDesc.role_id;

  if (!hasAdminId) {
    try {
      await qi.addColumn('AdminRoles', 'AdminId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added AdminId column to AdminRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('AdminId column already exists, skipping...');
      } else {
        throw error;
      }
    }
  }
  if (!hasRoleId) {
    try {
      await qi.addColumn('AdminRoles', 'RoleId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added RoleId column to AdminRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('RoleId column already exists, skipping...');
      } else {
        throw error;
      }
    }
  }
} else {
  console.log('AdminRoles table does not exist, skipping column checks...');
}

// If AdminRoles has timestamps, recreate it without them
if (adminRoleTableExists) {
  const adminRoleDesc = await qi.describeTable('AdminRoles');
  if (adminRoleDesc.created_at || adminRoleDesc.updated_at) {
    console.log('Recreating AdminRoles table without timestamps...');
    await qi.dropTable('AdminRoles');
    await qi.createTable('AdminRoles', {
      AdminId: {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'admins', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      RoleId: {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }
    });
    console.log('AdminRoles table recreated without timestamps');
  }
}

// Fix PassengerRoles table structure if needed
const passengerRoleTableExists = await qi.showAllTables().then(tables => 
  tables.some(table => table.tableName === 'PassengerRoles')
);

if (passengerRoleTableExists) {
  const passengerRoleDesc = await qi.describeTable('PassengerRoles');
  const hasPassengerId = passengerRoleDesc.PassengerId || passengerRoleDesc.passengerId || passengerRoleDesc.passenger_id;
  const hasPassengerRoleId = passengerRoleDesc.RoleId || passengerRoleDesc.roleId || passengerRoleDesc.role_id;

  if (!hasPassengerId) {
    try {
      await qi.addColumn('PassengerRoles', 'PassengerId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'passengers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added PassengerId column to PassengerRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('PassengerId column already exists in PassengerRoles, skipping...');
      } else {
        throw error;
      }
    }
  }
  if (!hasPassengerRoleId) {
    try {
      await qi.addColumn('PassengerRoles', 'RoleId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added RoleId column to PassengerRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('RoleId column already exists in PassengerRoles, skipping...');
      } else {
        throw error;
      }
    }
  }
} else {
  console.log('PassengerRoles table does not exist, skipping column checks...');
}

// Fix DriverRoles table structure if needed
const driverRoleTableExists = await qi.showAllTables().then(tables => 
  tables.some(table => table.tableName === 'DriverRoles')
);

if (driverRoleTableExists) {
  const driverRoleDesc = await qi.describeTable('DriverRoles');
  const hasDriverId = driverRoleDesc.DriverId || driverRoleDesc.driverId || driverRoleDesc.driver_id;
  const hasDriverRoleId = driverRoleDesc.RoleId || driverRoleDesc.roleId || driverRoleDesc.role_id;

  if (!hasDriverId) {
    try {
      await qi.addColumn('DriverRoles', 'DriverId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added DriverId column to DriverRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('DriverId column already exists in DriverRoles, skipping...');
      } else {
        throw error;
      }
    }
  }
  if (!hasDriverRoleId) {
    try {
      await qi.addColumn('DriverRoles', 'RoleId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added RoleId column to DriverRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('RoleId column already exists in DriverRoles, skipping...');
      } else {
        throw error;
      }
    }
  }
} else {
  console.log('DriverRoles table does not exist, skipping column checks...');
}

// Fix StaffRoles table structure if needed
const staffRoleTableExists = await qi.showAllTables().then(tables => 
  tables.some(table => table.tableName === 'StaffRoles')
);

if (staffRoleTableExists) {
  const staffRoleDesc = await qi.describeTable('StaffRoles');
  const hasStaffId = staffRoleDesc.StaffId || staffRoleDesc.staffId || staffRoleDesc.staff_id;
  const hasStaffRoleId = staffRoleDesc.RoleId || staffRoleDesc.roleId || staffRoleDesc.role_id;

  if (!hasStaffId) {
    try {
      await qi.addColumn('StaffRoles', 'StaffId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'staff', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added StaffId column to StaffRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('StaffId column already exists in StaffRoles, skipping...');
      } else {
        throw error;
      }
    }
  }
  if (!hasStaffRoleId) {
    try {
      await qi.addColumn('StaffRoles', 'RoleId', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
      console.log('Added RoleId column to StaffRoles');
    } catch (error) {
      if (error.message.includes('Duplicate column name')) {
        console.log('RoleId column already exists in StaffRoles, skipping...');
      } else {
        throw error;
      }
    }
  }
} else {
  console.log('StaffRoles table does not exist, skipping column checks...');
}

// Attach superadmin role to admin
console.log('Attempting to assign role:', { adminId: admin.id, roleId: superAdminRole.id });

// Try direct INSERT first (only if AdminRoles table exists)
if (adminRoleTableExists) {
  try {
    await sequelize.query(`INSERT IGNORE INTO \`AdminRoles\` (\`AdminId\`, \`RoleId\`) VALUES (?, ?)`, {
      replacements: [admin.id, superAdminRole.id],
    });
    console.log('Role assignment successful');
  } catch (error) {
    console.log('Direct INSERT failed:', error.message);
    // Try using Sequelize association
    try {
      await admin.setRoles([superAdminRole]);
      console.log('Sequelize association successful');
    } catch (assocError) {
      console.log('Sequelize association failed:', assocError.message);
    }
  }
} else {
  console.log('AdminRoles table does not exist, skipping role assignment...');
}

// Debug: Check what's in AdminRoles table
if (adminRoleTableExists) {
  const adminRolesData = await sequelize.query(`SELECT * FROM AdminRoles WHERE AdminId = ?`, {
    replacements: [admin.id],
    type: sequelize.QueryTypes.SELECT
  });
  console.log('AdminRoles data:', adminRolesData);
} else {
  console.log('AdminRoles table does not exist, skipping debug query...');
}

// Debug: Check if superadmin role exists
const superAdminCheck = await models.Role.findByPk(superAdminRole.id);
console.log('Superadmin role exists:', !!superAdminCheck, 'ID:', superAdminRole.id);

// Verify the admin has the superadmin role
const adminWithRoles = await models.Admin.findByPk(admin.id, {
  include: [{ association: 'roles', include: ['permissions'] }]
});
console.log('Admin roles:', adminWithRoles.roles.map(r => r.name));
console.log('Admin permissions:', adminWithRoles.roles.flatMap(r => r.permissions.map(p => p.name)));

console.log('Seed completed. Admin: rootadmin/admin123');
process.exit(0);
} catch (e) {
console.error(e);
process.exit(1);
}
}
run();
