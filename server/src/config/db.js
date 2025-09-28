// server/src/config/db.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI; // 👈 unifica este nombre en tu .env
  if (!uri) {
    console.error('[DB] MONGODB_URI no está definida en las variables de entorno');
    process.exit(1);
  }

  try {
    // Opcional: comportamiento de consultas (mejor explícito)
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(uri, {
      // tiempos y pool pensados para prod (Render/Vercel/Atlas)
      serverSelectionTimeoutMS: 10000, // 10s para elegir nodo
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4,
      retryWrites: true,
      w: 'majority',
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('❌ Error de conexión a MongoDB:', err?.message || err);
    process.exit(1); // falla rápido para que el orquestador reinicie
  }
};
