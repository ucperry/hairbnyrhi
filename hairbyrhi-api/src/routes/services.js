const express = require('express');
const router = express.Router();
const { queryMany, queryOne } = require('../utils/database');

/**
 * GET /api/services
 * Get all active services
 */
router.get('/', async (req, res) => {
  try {
    const services = await queryMany(`
      SELECT 
        id,
        name,
        duration_minutes,
        description,
        price,
        max_concurrent
      FROM services 
      WHERE is_active = true 
        AND deleted_at IS NULL
      ORDER BY name ASC
    `);

    res.json({
      success: true,
      data: services,
      count: services.length
    });

  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services'
    });
  }
});

/**
 * GET /api/services/:id
 * Get a specific service by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID is a number
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid service ID'
      });
    }

    const service = await queryOne(`
      SELECT 
        id,
        name,
        duration_minutes,
        description,
        price,
        max_concurrent,
        cancellation_hours,
        reschedule_hours
      FROM services 
      WHERE id = $1 
        AND is_active = true 
        AND deleted_at IS NULL
    `, [id]);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    res.json({
      success: true,
      data: service
    });

  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service'
    });
  }
});

module.exports = router;