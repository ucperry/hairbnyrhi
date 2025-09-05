// routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database'); // Your existing database connection

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        error: 'Too many login attempts, please try again in 15 minutes',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Validation middleware
const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email address is required'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('rememberMe')
        .optional()
        .isBoolean()
        .withMessage('Remember me must be a boolean value')
];

const passwordResetValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email address is required')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match');
            }
            return true;
        })
];

// Helper function to generate JWT token
const generateToken = (user, rememberMe = false) => {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
    };

    const options = {
        expiresIn: rememberMe ? '30d' : '24h',
        issuer: 'hairbyrhi-api',
        audience: 'hairbyrhi-admin'
    };

    return jwt.sign(payload, process.env.JWT_SECRET, options);
};

// Helper function to hash password
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate admin user and return JWT token
 * @access  Public (with rate limiting)
 */
router.post('/login', authLimiter, loginValidation, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const { email, password, rememberMe = false } = req.body;

        // Query user from database
        const userQuery = `
            SELECT 
                id, 
                email, 
                password_hash, 
                first_name, 
                last_name, 
                role, 
                is_active, 
                last_login_at,
                failed_login_attempts,
                locked_until
            FROM admin_users 
            WHERE email = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [email]);

        if (userResult.rows.length === 0) {
            // Log failed login attempt
            console.log(`Failed login attempt for non-existent user: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const user = userResult.rows[0];

        // Check if account is locked
        if (user.locked_until && new Date() < new Date(user.locked_until)) {
            const lockTimeRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / (1000 * 60));
            return res.status(423).json({
                success: false,
                message: `Account is locked. Try again in ${lockTimeRemaining} minutes.`,
                code: 'ACCOUNT_LOCKED'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            // Increment failed login attempts
            const failedAttempts = (user.failed_login_attempts || 0) + 1;
            let lockUntil = null;

            // Lock account after 5 failed attempts for 30 minutes
            if (failedAttempts >= 5) {
                lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
            }

            await pool.query(`
                UPDATE admin_users 
                SET 
                    failed_login_attempts = $1,
                    locked_until = $2
                WHERE id = $3
            `, [failedAttempts, lockUntil, user.id]);

            console.log(`Failed login attempt for user: ${email}, attempts: ${failedAttempts}`);

            return res.status(401).json({
                success: false,
                message: lockUntil ? 
                    'Too many failed attempts. Account locked for 30 minutes.' : 
                    'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Successful login - reset failed attempts and update last login
        await pool.query(`
            UPDATE admin_users 
            SET 
                failed_login_attempts = 0,
                locked_until = NULL,
                last_login_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [user.id]);

        // Generate JWT token
        const token = generateToken(user, rememberMe);

        // Log successful login
        console.log(`Successful login for user: ${email}`);

        // Return success response
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    lastLogin: user.last_login_at
                },
                expiresIn: rememberMe ? '30d' : '24h'
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during login',
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token invalidation)
 * @access  Private
 */
router.post('/logout', async (req, res) => {
    try {
        // Extract token from header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            // In a production environment, you might want to maintain a blacklist
            // of invalidated tokens or use a token store like Redis
            console.log('User logged out successfully');
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during logout'
        });
    }
});

/**
 * @route   GET /api/auth/verify
 * @desc    Verify JWT token and return user data
 * @access  Private
 */
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required',
                code: 'TOKEN_REQUIRED'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get fresh user data from database
        const userQuery = `
            SELECT 
                id, 
                email, 
                first_name, 
                last_name, 
                role, 
                is_active,
                last_login_at
            FROM admin_users 
            WHERE id = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [decoded.id]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive',
                code: 'USER_NOT_FOUND'
            });
        }

        const user = userResult.rows[0];

        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    lastLogin: user.last_login_at
                },
                tokenExp: decoded.exp
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during token verification'
        });
    }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', changePasswordValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { currentPassword, newPassword } = req.body;

        // Get current user data
        const userQuery = `
            SELECT id, password_hash 
            FROM admin_users 
            WHERE id = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [decoded.id]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update password in database
        await pool.query(`
            UPDATE admin_users 
            SET 
                password_hash = $1,
                password_changed_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [newPasswordHash, decoded.id]);

        console.log(`Password changed for user ID: ${decoded.id}`);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset (placeholder for email integration)
 * @access  Public
 */
router.post('/forgot-password', authLimiter, passwordResetValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errors.array()
            });
        }

        const { email } = req.body;

        // Check if user exists
        const userQuery = `
            SELECT id, email, first_name, last_name
            FROM admin_users 
            WHERE email = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [email]);

        // Always return success for security (don't reveal if email exists)
        res.json({
            success: true,
            message: 'If an account with that email exists, password reset instructions have been sent.'
        });

        // If user exists, log the request (in production, send email)
        if (userResult.rows.length > 0) {
            console.log(`Password reset requested for: ${email}`);
            
            // TODO: Implement email sending functionality
            // - Generate secure reset token
            // - Store token with expiration in database
            // - Send email with reset link
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token is required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userQuery = `
            SELECT 
                id, 
                email, 
                first_name, 
                last_name, 
                role, 
                created_at,
                last_login_at,
                password_changed_at
            FROM admin_users 
            WHERE id = $1 AND is_active = true
        `;

        const userResult = await pool.query(userQuery, [decoded.id]);

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    createdAt: user.created_at,
                    lastLogin: user.last_login_at,
                    passwordChangedAt: user.password_changed_at
                }
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;