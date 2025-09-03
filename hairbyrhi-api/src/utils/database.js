const { pool } = require('../../config/database');

/**
 * Execute a database query
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params = []) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log queries in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Database query error:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      error: error.message
    });
    throw error;
  }
};

/**
 * Execute a query and return the first row
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} First row or null
 */
const queryOne = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

/**
 * Execute a query and return all rows
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Array of rows
 */
const queryMany = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows;
};

/**
 * Begin a database transaction
 * @returns {Promise<Object>} Transaction client
 */
const beginTransaction = async () => {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
};

/**
 * Commit a database transaction
 * @param {Object} client - Transaction client
 */
const commitTransaction = async (client) => {
  await client.query('COMMIT');
  client.release();
};

/**
 * Rollback a database transaction
 * @param {Object} client - Transaction client
 */
const rollbackTransaction = async (client) => {
  await client.query('ROLLBACK');
  client.release();
};

module.exports = {
  query,
  queryOne,
  queryMany,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
};