const dbConfig = require('./db');
const jwtConfig = require('./jwt.config');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

module.exports = {
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/intranet',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  jwt: jwtConfig,
  corsOptions: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
};