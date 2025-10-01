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
    const hasMainTables = existingTables.some(table => 
      ['admins', 'passengers', 'drivers', 'roles', 'permissions'].includes(table.tableName)
    );
    
    if (hasMainTables) {
      console.log('Main tables exist, skipping sync to avoid column conflicts...');
      console.log('Database schema is ready!');
    } else {
      console.log('Fresh database detected, running initial sync...');
      try {
        await sequelize.sync({ alter: true });
        console.log('Database synced!');
      } catch (syncError) {
        if (syncError.message.includes('Duplicate column name')) {
          console.log('Some columns already exist, continuing with existing schema...');
          await sequelize.sync({ force: false });
          console.log('Database tables verified!');
        } else {
          throw syncError;
        }
      }
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
