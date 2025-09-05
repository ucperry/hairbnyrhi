const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool - Use DATABASE_URL if available, fallback to discrete vars
const pool = new Pool(
  process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        // Connection pool settings
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: {
          rejectUnauthorized: false // Required for Neon database connections
        },
        // Connection pool settings
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    console.log(`📊 Connected to: ${process.env.DB_NAME} as ${process.env.DB_USER}`);
    console.log(`🌐 Host: ${process.env.DB_HOST}`);
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Check your Neon database credentials and network connection');
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Closing database connections...');
  pool.end(() => {
    console.log('✅ Database connections closed');
    process.exit(0);
  });
});

module.exports = {
  pool,
  testConnection
};