// Update your existing routes/admin.js file
// Add these imports at the top and protect your routes

const express = require('express');
const { pool } = require('../../config/database');
const { protectAdminRoute, authenticateToken, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/admin/requests
 * @desc    Get all appointment requests with filtering
 * @access  Protected - Admin only
 */
router.get('/requests', protectAdminRoute(), async (req, res) => {
    try {
        // Log the authenticated user
        console.log(`Admin requests accessed by: ${req.user.fullName} (${req.user.email})`);

        const { status, limit = 50, offset = 0 } = req.query;
        
        // Build query with optional status filter
        let query = `
            SELECT 
                ar.id,
                ar.customer_id,
                ar.service_id,
                ar.customer_notes,
                ar.admin_notes,
                ar.status,
                ar.created_at,
                ar.updated_at,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                s.name as service_name,
                s.price as service_price,
                s.duration as service_duration,
                -- Get preferred times
                array_agg(
                    json_build_object(
                        'preferred_time', rtp.preferred_time,
                        'priority', rtp.priority
                    ) ORDER BY rtp.priority
                ) as preferred_times
            FROM appointment_requests ar
            JOIN customers c ON ar.customer_id = c.id
            JOIN services s ON ar.service_id = s.id
            LEFT JOIN request_time_preferences rtp ON ar.id = rtp.request_id
        `;

        const queryParams = [];
        
        if (status) {
            query += ` WHERE ar.status = $${queryParams.length + 1}`;
            queryParams.push(status);
        }

        query += `
            GROUP BY ar.id, c.id, s.id
            ORDER BY ar.created_at DESC
            LIMIT $${queryParams.length + 1}
            OFFSET $${queryParams.length + 2}
        `;

        queryParams.push(limit, offset);

        const result = await pool.query(query, queryParams);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) FROM appointment_requests ar';
        let countParams = [];
        
        if (status) {
            countQuery += ' WHERE ar.status = $1';
            countParams.push(status);
        }

        const countResult = await pool.query(countQuery, countParams);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                requests: result.rows,
                pagination: {
                    total: totalCount,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < totalCount
                },
                authenticatedUser: {
                    name: req.user.fullName,
                    email: req.user.email,
                    role: req.user.role
                }
            }
        });

    } catch (error) {
        console.error('Error fetching admin requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointment requests',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get dashboard statistics and summary
 * @access  Protected - Admin only
 */
router.get('/dashboard', protectAdminRoute(), async (req, res) => {
    try {
        console.log(`Dashboard accessed by: ${req.user.fullName} (${req.user.email})`);

        // Get various statistics in parallel
        const [
            pendingRequestsResult,
            totalRequestsResult,
            totalCustomersResult,
            recentRequestsResult,
            servicesResult
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM appointment_requests WHERE status = 'pending'"),
            pool.query("SELECT COUNT(*) FROM appointment_requests"),
            pool.query("SELECT COUNT(*) FROM customers"),
            pool.query(`
                SELECT 
                    ar.id,
                    ar.status,
                    ar.created_at,
                    c.first_name,
                    c.last_name,
                    s.name as service_name
                FROM appointment_requests ar
                JOIN customers c ON ar.customer_id = c.id
                JOIN services s ON ar.service_id = s.id
                ORDER BY ar.created_at DESC
                LIMIT 5
            `),
            pool.query("SELECT COUNT(*) as count, s.name FROM appointment_requests ar JOIN services s ON ar.service_id = s.id GROUP BY s.name ORDER BY count DESC LIMIT 5")
        ]);

        const stats = {
            pendingRequests: parseInt(pendingRequestsResult.rows[0].count),
            totalRequests: parseInt(totalRequestsResult.rows[0].count),
            totalCustomers: parseInt(totalCustomersResult.rows[0].count),
            recentRequests: recentRequestsResult.rows,
            popularServices: servicesResult.rows
        };

        res.json({
            success: true,
            data: {
                stats,
                user: {
                    name: req.user.fullName,
                    email: req.user.email,
                    role: req.user.role,
                    welcomeMessage: `Welcome back, ${req.user.firstName}!`
                },
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   PUT /api/admin/requests/:id/approve
 * @desc    Approve an appointment request and create confirmed appointment
 * @access  Protected - Admin only
 */
router.put('/requests/:id/approve', protectAdminRoute(), async (req, res) => {
    const requestId = req.params.id;
    const { preferredTimeId, adminNotes } = req.body;

    try {
        console.log(`Request ${requestId} approval attempted by: ${req.user.fullName}`);

        // Start transaction
        await pool.query('BEGIN');

        // Get the request details and preferred time
        const requestQuery = `
            SELECT 
                ar.*,
                rtp.preferred_time
            FROM appointment_requests ar
            LEFT JOIN request_time_preferences rtp ON ar.id = rtp.request_id
            WHERE ar.id = $1 AND rtp.id = $2
        `;

        const requestResult = await pool.query(requestQuery, [requestId, preferredTimeId]);

        if (requestResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                message: 'Request or preferred time not found'
            });
        }

        const request = requestResult.rows[0];

        if (request.status !== 'pending') {
            await pool.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Only pending requests can be approved'
            });
        }

        // Create confirmed appointment
        const appointmentQuery = `
            INSERT INTO appointments (
                customer_id,
                service_id,
                scheduled_time,
                status,
                notes,
                created_by,
                created_at
            ) VALUES ($1, $2, $3, 'scheduled', $4, $5, CURRENT_TIMESTAMP)
            RETURNING id
        `;

        const appointmentResult = await pool.query(appointmentQuery, [
            request.customer_id,
            request.service_id,
            request.preferred_time,
            adminNotes || 'Approved via admin panel',
            req.user.id
        ]);

        // Update request status
        await pool.query(`
            UPDATE appointment_requests 
            SET 
                status = 'confirmed',
                admin_notes = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [adminNotes || `Approved by ${req.user.fullName}`, requestId]);

        await pool.query('COMMIT');

        res.json({
            success: true,
            message: 'Request approved and appointment created successfully',
            data: {
                appointmentId: appointmentResult.rows[0].id,
                approvedBy: req.user.fullName,
                approvedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error approving request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve request',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   PUT /api/admin/requests/:id/reschedule
 * @desc    Suggest alternative time for appointment request
 * @access  Protected - Admin only
 */
router.put('/requests/:id/reschedule', protectAdminRoute(), async (req, res) => {
    const requestId = req.params.id;
    const { suggestedTime, adminNotes } = req.body;

    try {
        console.log(`Request ${requestId} reschedule by: ${req.user.fullName}`);

        const updateQuery = `
            UPDATE appointment_requests 
            SET 
                status = 'rescheduled',
                admin_notes = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND status = 'pending'
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            `${adminNotes} - Suggested time: ${suggestedTime} (by ${req.user.fullName})`,
            requestId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Request not found or not in pending status'
            });
        }

        res.json({
            success: true,
            message: 'Reschedule suggestion sent successfully',
            data: {
                request: result.rows[0],
                rescheduledBy: req.user.fullName,
                suggestedTime
            }
        });

    } catch (error) {
        console.error('Error rescheduling request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reschedule request'
        });
    }
});

/**
 * @route   DELETE /api/admin/requests/:id
 * @desc    Cancel/reject an appointment request
 * @access  Protected - Admin only
 */
router.delete('/requests/:id', protectAdminRoute(), async (req, res) => {
    const requestId = req.params.id;
    const { reason } = req.body;

    try {
        console.log(`Request ${requestId} cancellation by: ${req.user.fullName}`);

        const updateQuery = `
            UPDATE appointment_requests 
            SET 
                status = 'cancelled',
                admin_notes = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            `Cancelled by ${req.user.fullName}. Reason: ${reason || 'No reason provided'}`,
            requestId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }

        res.json({
            success: true,
            message: 'Request cancelled successfully',
            data: {
                request: result.rows[0],
                cancelledBy: req.user.fullName,
                reason: reason || 'No reason provided'
            }
        });

    } catch (error) {
        console.error('Error cancelling request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel request'
        });
    }
});

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users (super admin only)
 * @access  Protected - Super Admin only
 */


// Temporary debug - add this before module.exports
console.log('🔍 Auth routes registered:', router.stack.map(layer => `${layer.route?.stack[0]?.method?.toUpperCase()} ${layer.route?.path}`));

module.exports = router;