console.log('🔍 Starting server.js...');

const app = require('./src/app');
console.log('✅ App loaded successfully');

const { testConnection } = require('./config/database');
console.log('✅ Database config loaded successfully');

require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Test database connection before starting server
const startServer = async () => {
  try {
    console.log('🔄 Testing database connection...');
    await testConnection();
    
    app.listen(PORT, () => {
      console.log(`🚀 Hair by Rhi API server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();