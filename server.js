const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
require('dotenv').config();

const { sequelize } = require('./config/database');
const routes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Log any non-2xx/3xx responses
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      const durationMs = Date.now() - startedAt;
      console.error('[HTTP ERROR]', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userId: req.user?.id,
        userType: req.user?.type,
      });
    }
  });
  next();
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// ✅ Keep the /api prefix for all routes
app.use('/api', routes);

app.get('/', (req, res) => res.json({ status: 'ok' }));

// Centralized error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error('[UNHANDLED ERROR]', {
    method: req.method,
    url: req.originalUrl,
    status,
    ip: req.ip,
    userId: req.user?.id,
    userType: req.user?.type,
    message: err.message,
    stack: err.stack,
  });
  if (res.headersSent) return;
  res.status(status).json({ message: err.message || 'Internal server error' });
});

const port = Number(process.env.PORT || 3000);

async function start() {
  try {
    // Authenticate & sync DB
    await sequelize.authenticate();
    console.log('Database connected!');
    
    // Run dispute tables migration first
    const migrateDisputeTables = require('./seed/migrate_dispute_tables');
    await migrateDisputeTables();
    
    // Check if main tables exist to determine sync strategy
    const qi = sequelize.getQueryInterface();
    const existingTables = await qi.showAllTables();
    const tableNames = Array.isArray(existingTables)
      ? existingTables.map(t => (typeof t === 'string' ? t : (t && (t.tableName || t.table_name)) || String(t)))
      : [];
    const lowerTableNames = tableNames.map(n => String(n).toLowerCase());
    const hasMainTables = lowerTableNames.some(name => ['admins', 'passengers', 'drivers', 'roles', 'permissions', 'staff'].includes(name));

    // Ensure required through tables exist (created by associations)
    const requiredThroughTables = [
      'passengerroles',
      'driverroles',
      'staffroles',
      'adminroles',
      'rolepermissions'
    ];
    const missingThroughTables = requiredThroughTables.filter(t => !lowerTableNames.includes(t));
    
    const isProduction = (process.env.NODE_ENV || '').toLowerCase() === 'production';
    const syncMode = (process.env.DB_SYNC || '').toLowerCase(); // '', 'alter', 'force', 'none'

    if (syncMode === 'force') {
      console.log('DB_SYNC=force detected. Dropping and recreating all tables...');
      await sequelize.sync({ force: true });
      console.log('Database force-synced!');
    } else if (syncMode === 'alter') {
      console.log('DB_SYNC=alter detected. Altering tables to match models...');
      await sequelize.sync({ alter: true });
      console.log('Database alter-synced!');
    } else if (!isProduction && (!hasMainTables || missingThroughTables.length > 0)) {
      if (!hasMainTables) {
        console.log('Fresh database detected in non-production, running initial alter sync...');
      } else {
        console.log('Missing association tables detected:', missingThroughTables.join(', ') || 'none');
        console.log('Running targeted alter-sync to create missing through tables...');
      }
      await sequelize.sync({ alter: true });
      console.log('Database synced!');
    } else {
      console.log('Existing tables detected or production mode; skipping sync. Set DB_SYNC=alter or DB_SYNC=force to override.');
    }

    app.listen(port, () =>
      console.log(`Server running on http://localhost:${port}`)
    );
  } catch (e) {
    console.error('Failed to start', e);
    process.exit(1);
  }
}

// Start the server
start();

// Global process-level error logging
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
