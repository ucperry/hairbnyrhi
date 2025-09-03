const express = require('express');
const router = express.Router();
const { queryOne, queryMany } = require('../utils/database');

/**
 * GET /api/admin/requests
 * Get all appointment requests with full details
 */
router.get('/requests', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    let query = `
      SELECT 
        ar.id,
        ar.status,
        ar.customer_notes,
        ar.admin_notes,
        ar.created_at,
        ar.updated_at,
        c.id as customer_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        s.id as service_id,
        s.name as service_name,
        s.duration_minutes,
        s.price,
        s.max_concurrent
      FROM appointment_requests ar
      JOIN customers c ON ar.customer_id = c.id
      JOIN services s ON ar.service_id = s.id
      WHERE ar.deleted_at IS NULL
    `;
    
    let params = [];
    
    if (status !== 'all') {
      query += ` AND ar.status = $1`;
      params = [status];
    }
    
    query += ` ORDER BY ar.created_at DESC`;
    
    const requests = await queryMany(query, params);

    // Get time preferences for each request
    const requestsWithPreferences = await Promise.all(
      requests.map(async (request) => {
        const preferences = await queryMany(`
          SELECT 
            id,
            preferred_datetime,
            priority,
            is_selected
          FROM request_time_preferences
          WHERE request_id = $1
          ORDER BY priority ASC
        `, [request.id]);

        return {
          request_id: request.id,
          status: request.status,
          customer: {
            id: request.customer_id,
            name: request.customer_name,
            email: request.customer_email,
            phone: request.customer_phone
          },
          service: {
            id: request.service_id,
            name: request.service_name,
            duration_minutes: request.duration_minutes,
            price: request.price,
            max_concurrent: request.max_concurrent
          },
          preferred_times: preferences,
          notes: request.customer_notes,
          admin_notes: request.admin_notes,
          submitted_at: request.created_at,
          updated_at: request.updated_at
        };
      })
    );

    res.json({
      success: true,
      data: requestsWithPreferences,
      count: requestsWithPreferences.length
    });

  } catch (error) {
    console.error('Error fetching admin requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch requests'
    });
  }
});

// Keep the dashboard endpoint the same
router.get('/dashboard', async (req, res) => {
  try {
    const pendingCount = await queryOne(`
      SELECT COUNT(*) as pending_requests
      FROM appointment_requests 
      WHERE status = 'pending' AND deleted_at IS NULL
    `);

    res.json({
      success: true,
      data: {
        stats: {
          pending_requests: parseInt(pendingCount.pending_requests)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

module.exports = router;