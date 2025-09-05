// scripts/createAdminUser.js
// Script to create the first admin user for Hair by Rhiannon

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../config/database'); // Your existing database connection
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

// Helper function to hash password
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

// Validate email format
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Check if user already exists
const checkUserExists = async (email) => {
    try {
        const result = await pool.query(
            'SELECT id, email FROM admin_users WHERE email = $1',
            [email]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking user existence:', error);
        throw error;
    }
};

// Create admin user
const createAdminUser = async (userData) => {
    try {
        const { email, password, firstName, lastName, role } = userData;
        
        // Hash the password
        const passwordHash = await hashPassword(password);
        
        // Insert user into database
        const insertQuery = `
            INSERT INTO admin_users (
                email, 
                password_hash, 
                first_name, 
                last_name, 
                role,
                is_active,
                created_at,
                password_changed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id, email, first_name, last_name, role, created_at
        `;
        
        const result = await pool.query(insertQuery, [
            email,
            passwordHash,
            firstName,
            lastName,
            role,
            true
        ]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating admin user:', error);
        throw error;
    }
};

// Main setup function
const setupAdminUser = async () => {
    console.log('\n🎨 Hair by Rhiannon - Admin User Setup');
    console.log('======================================\n');
    
    try {
        // Check database connection
        console.log('📊 Checking database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful\n');
        
        // Check if admin_users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'admin_users'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ admin_users table does not exist!');
            console.log('Please run the database schema setup first.');
            process.exit(1);
        }
        
        console.log('✅ admin_users table found\n');
        
        // Get user input
        console.log('Please enter the details for the first admin user:\n');
        
        let email, firstName, lastName, password, confirmPassword;
        
        // Email input with validation
        do {
            email = await askQuestion('Email address: ');
            if (!isValidEmail(email)) {
                console.log('❌ Please enter a valid email address');
            } else {
                // Check if user already exists
                const userExists = await checkUserExists(email);
                if (userExists) {
                    console.log('❌ User with this email already exists');
                    email = null;
                }
            }
        } while (!email);
        
        // Name input
        do {
            firstName = await askQuestion('First name: ');
            if (!firstName.trim()) {
                console.log('❌ First name is required');
            }
        } while (!firstName.trim());
        
        do {
            lastName = await askQuestion('Last name: ');
            if (!lastName.trim()) {
                console.log('❌ Last name is required');
            }
        } while (!lastName.trim());
        
        // Password input with confirmation
        do {
            password = await askQuestion('Password (min 6 characters): ');
            if (password.length < 6) {
                console.log('❌ Password must be at least 6 characters long');
                continue;
            }
            
            confirmPassword = await askQuestion('Confirm password: ');
            if (password !== confirmPassword) {
                console.log('❌ Passwords do not match');
                password = null;
            }
        } while (!password);
        
        // Role selection
        console.log('\nAvailable roles:');
        console.log('1. admin (standard admin access)');
        console.log('2. super_admin (full system access)');
        
        let roleChoice;
        do {
            roleChoice = await askQuestion('Select role (1 or 2): ');
        } while (roleChoice !== '1' && roleChoice !== '2');
        
        const role = roleChoice === '1' ? 'admin' : 'super_admin';
        
        // Confirm details
        console.log('\n📋 User Details Summary:');
        console.log('========================');
        console.log(`Email: ${email}`);
        console.log(`Name: ${firstName} ${lastName}`);
        console.log(`Role: ${role}`);
        
        const confirm = await askQuestion('\nCreate this admin user? (y/n): ');
        
        if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
            console.log('❌ User creation cancelled');
            process.exit(0);
        }
        
        // Create the user
        console.log('\n🔨 Creating admin user...');
        
        const userData = {
            email: email.toLowerCase().trim(),
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role
        };
        
        const newUser = await createAdminUser(userData);
        
        console.log('\n✅ Admin user created successfully!');
        console.log('==================================');
        console.log(`User ID: ${newUser.id}`);
        console.log(`Email: ${newUser.email}`);
        console.log(`Name: ${newUser.first_name} ${newUser.last_name}`);
        console.log(`Role: ${newUser.role}`);
        console.log(`Created: ${newUser.created_at}`);
        
        console.log('\n🚀 You can now use these credentials to log into the admin panel!');
        console.log(`Login URL: http://localhost:3000/admin-login.html`);
        
    } catch (error) {
        console.error('\n❌ Error during setup:', error.message);
        process.exit(1);
    } finally {
        rl.close();
        await pool.end();
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n❌ Setup cancelled by user');
    rl.close();
    pool.end().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
    console.log('\n\n❌ Setup terminated');
    rl.close();
    pool.end().then(() => process.exit(0));
});

// Run the setup if this script is executed directly
if (require.main === module) {
    setupAdminUser();
}

module.exports = { createAdminUser, hashPassword };