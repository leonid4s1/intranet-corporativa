// src/config/db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      socketTimeoutMS: 45000,
      family: 4,
      connectTimeoutMS: 30000
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}/${conn.connection.name}`);
    
    return conn;
  } catch (err) {
    console.error('❌ Error de conexión a MongoDB:', err.message);
    throw err;
  }
};