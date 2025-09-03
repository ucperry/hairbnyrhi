const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { query, queryOne, queryMany, beginTransaction, commitTransaction, rollbackTransaction } = require('../utils/database');

// Validation schema for booking requests
const bookingSchema = Joi.object({
  customer: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().min(10).max(20).required()
  }).required(),
  service_id: Joi.number().integer().positive().required(),
  preferred_times: Joi.array()
    .items(
      Joi.object({
        datetime: Joi.date().min('now').required(),
        priority: Joi.number().integer().min(1).max(3).required()
      })
    )
    .min(1)
    .max(3)
    .required(),
  notes: Joi.string().max(1000).allow('', null)
});

/**
 * POST /api/requests
 * Create a new appointment request
 */
router.post('/', async (req, res) => {
  let client = null;
  
  try {
    // Validate request body
    const { error, value } = bookingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    const { customer, service_id, preferred_times, notes } = value;

    // Start transaction
    client = await beginTransaction();

    // Check if service exists and is active
    const service = await queryOne(`
      SELECT id, name, duration_minutes 
      FROM services 
      WHERE id = $1 AND is_active = true AND deleted_at IS NULL
    `, [service_id]);

    if (!service) {
      await rollbackTransaction(client);
      return res.status(400).json({
        success: false,
        error: 'Invalid service selected'
      });
    }

    // Check if customer exists, if not create them
    let customerRecord = await queryOne(`
      SELECT id FROM customers 
      WHERE email = $1 AND deleted_at IS NULL
    `, [customer.email]);

    if (!customerRecord) {
      // Create new customer
      const customerResult = await client.query(`
        INSERT INTO customers (name, email, phone) 
        VALUES ($1, $2, $3) 
        RETURNING id
      `, [customer.name, customer.email, customer.phone]);
      
      customerRecord = customerResult.rows[0];
    } else {
      // Update existing customer info (in case phone number changed)
      await client.query(`
        UPDATE customers 
        SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [customer.name, customer.phone, customerRecord.id]);
    }

    // Create appointment request
    const requestResult = await client.query(`
      INSERT INTO appointment_requests (customer_id, service_id, customer_notes, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `, [customerRecord.id, service_id, notes || null]);

    const requestId = requestResult.rows[0].id;

    // Add preferred time slots
    for (const timePreference of preferred_times) {
      await client.query(`
        INSERT INTO request_time_preferences (request_id, preferred_datetime, priority)
        VALUES ($1, $2, $3)
      `, [requestId, timePreference.datetime, timePreference.priority]);
    }

    // Commit transaction
    await commitTransaction(client);

    // Get the complete request data to return
    const completeRequest = await queryOne(`
      SELECT 
        ar.id,
        ar.status,
        ar.customer_notes,
        ar.created_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        s.name as service_name,
        s.duration_minutes,
        s.price
      FROM appointment_requests ar
      JOIN customers c ON ar.customer_id = c.id
      JOIN services s ON ar.service_id = s.id
      WHERE ar.id = $1
    `, [requestId]);

    const timePreferences = await queryMany(`
      SELECT preferred_datetime, priority
      FROM request_time_preferences
      WHERE request_id = $1
      ORDER BY priority ASC
    `, [requestId]);

    res.status(201).json({
      success: true,
      message: 'Booking request submitted successfully',
      data: {
        request_id: completeRequest.id,
        status: completeRequest.status,
        customer: {
          name: completeRequest.customer_name,
          email: completeRequest.customer_email,
          phone: completeRequest.customer_phone
        },
        service: {
          name: completeRequest.service_name,
          duration_minutes: completeRequest.duration_minutes,
          price: completeRequest.price
        },
        preferred_times: timePreferences,
        notes: completeRequest.customer_notes,
        submitted_at: completeRequest.created_at
      }
    });

  } catch (error) {
    // Rollback transaction if it exists
    if (client) {
      await rollbackTransaction(client);
    }
    
    console.error('Error creating booking request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking request'
    });
  }
});

/**
 * GET /api/requests/:id
 * Get a specific request by ID (for customers to check status)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request ID'
      });
    }

    const request = await queryOne(`
      SELECT 
        ar.id,
        ar.status,
        ar.customer_notes,
        ar.admin_notes,
        ar.created_at,
        ar.updated_at,
        c.name as customer_name,
        c.email as customer_email,
        s.name as service_name,
        s.duration_minutes,
        s.price
      FROM appointment_requests ar
      JOIN customers c ON ar.customer_id = c.id
      JOIN services s ON ar.service_id = s.id
      WHERE ar.id = $1 AND ar.deleted_at IS NULL
    `, [id]);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const timePreferences = await queryMany(`
      SELECT preferred_datetime, priority, is_selected
      FROM request_time_preferences
      WHERE request_id = $1
      ORDER BY priority ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        request_id: request.id,
        status: request.status,
        customer: {
          name: request.customer_name,
          email: request.customer_email
        },
        service: {
          name: request.service_name,
          duration_minutes: request.duration_minutes,
          price: request.price
        },
        preferred_times: timePreferences,
        notes: request.customer_notes,
        admin_notes: request.admin_notes,
        submitted_at: request.created_at,
        updated_at: request.updated_at
      }
    });

  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch request'
    });
  }
});

module.exports = router;