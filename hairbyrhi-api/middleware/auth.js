// middleware/auth.js
// JWT Authentication Middleware for Hair by Rhiannon API

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Middleware to verify JWT tokens and protect routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required',
                code: 'TOKEN_REQUIRED'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get fresh user data from database to ensure user is still active
        const userQuery = `
            SELECT 
                id, 
                email, 
                first_name, 
                last_name, 
                role, 
                is_active
            FROM admin_users 
            WHERE id = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [decoded.id]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found or account deactivated',
                code: 'USER_NOT_FOUND'
            });
        }

        // Add user info to request object for use in protected routes
        req.user = {
            id: userResult.rows[0].id,
            email: userResult.rows[0].email,
            firstName: userResult.rows[0].first_name,
            lastName: userResult.rows[0].last_name,
            role: userResult.rows[0].role,
            fullName: `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
        };

        // Continue to the protected route
        next();

    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid access token',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Access token has expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'NotBeforeError') {
            return res.status(401).json({
                success: false,
                message: 'Access token not active yet',
                code: 'TOKEN_NOT_ACTIVE'
            });
        }

        // Handle database errors
        if (error.code) {
            console.error('Database error in auth middleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Database error during authentication',
                code: 'DATABASE_ERROR'
            });
        }

        // Handle other errors
        console.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal error during authentication',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Middleware to require specific role(s) for access
 * @param {string|Array} requiredRoles - Single role or array of roles
 * @returns {Function} Express middleware function
 */
const requireRole = (requiredRoles) => {
    return (req, res, next) => {
        // Ensure user is authenticated first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        // Convert to array if single role provided
        const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        // Check if user has required role
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${roles.join(' or ')}`,
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }

        next();
    };
};

/**
 * Middleware to require super admin access
 */
const requireSuperAdmin = requireRole('super_admin');

/**
 * Middleware to require admin or super admin access
 */
const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * Optional authentication middleware - adds user info if token exists but doesn't require it
 * Useful for endpoints that behave differently for authenticated vs anonymous users
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            // No token provided, continue without user info
            return next();
        }

        // Try to verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user data
        const userQuery = `
            SELECT 
                id, 
                email, 
                first_name, 
                last_name, 
                role, 
                is_active
            FROM admin_users 
            WHERE id = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [decoded.id]);

        if (userResult.rows.length > 0) {
            // Add user info to request
            req.user = {
                id: userResult.rows[0].id,
                email: userResult.rows[0].email,
                firstName: userResult.rows[0].first_name,
                lastName: userResult.rows[0].last_name,
                role: userResult.rows[0].role,
                fullName: `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
            };
        }

        next();

    } catch (error) {
        // If token is invalid, just continue without user info
        next();
    }
};

/**
 * Middleware to log authentication events
 */
const logAuthEvent = (event) => {
    return (req, res, next) => {
        const timestamp = new Date().toISOString();
        const userInfo = req.user ? `${req.user.email} (${req.user.role})` : 'anonymous';
        const ip = req.ip || req.connection.remoteAddress;
        
        console.log(`[${timestamp}] AUTH EVENT: ${event} - User: ${userInfo} - IP: ${ip} - Route: ${req.method} ${req.originalUrl}`);
        
        next();
    };
};

/**
 * Helper function to generate a middleware stack for protected admin routes
 * @param {string} requiredRole - Required role ('admin', 'super_admin', or array)
 * @returns {Array} Array of middleware functions
 */
const protectAdminRoute = (requiredRole = ['admin', 'super_admin']) => {
    return [
        authenticateToken,
        requireRole(requiredRole),
        logAuthEvent('admin_route_access')
    ];
};

module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin,
    requireSuperAdmin,
    optionalAuth,
    logAuthEvent,
    protectAdminRoute
};