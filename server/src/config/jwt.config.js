require('dotenv').config();

module.exports = {
  secret: process.env.JWT_SECRET || 'default_secret_key_123!',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret_key_456!',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  }
};