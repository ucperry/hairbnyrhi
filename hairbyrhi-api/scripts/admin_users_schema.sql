-- Create admin_users table for authentication
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for admin_users table
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to table and columns for documentation
COMMENT ON TABLE admin_users IS 'Administrative users with access to the Hair by Rhiannon management system';
COMMENT ON COLUMN admin_users.id IS 'Primary key for admin user';
COMMENT ON COLUMN admin_users.email IS 'Unique email address for login';
COMMENT ON COLUMN admin_users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN admin_users.first_name IS 'Admin user first name';
COMMENT ON COLUMN admin_users.last_name IS 'Admin user last name';
COMMENT ON COLUMN admin_users.role IS 'User role (admin, super_admin, etc.)';
COMMENT ON COLUMN admin_users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN admin_users.failed_login_attempts IS 'Counter for failed login attempts';
COMMENT ON COLUMN admin_users.locked_until IS 'Timestamp until which account is locked';
COMMENT ON COLUMN admin_users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN admin_users.password_changed_at IS 'Timestamp when password was last changed';

-- Create password reset tokens table for future use
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for password reset tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS 'Tokens for password reset functionality';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'Hashed reset token';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'When the token expires';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'When the token was used (if used)';

