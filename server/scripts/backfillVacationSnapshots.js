// server/scripts/backfillVacationSnapshots.js
import mongoose from 'mongoose';
import 'dotenv/config'; // lee .env automáticamente

// Importa modelos desde src (ajusta si tu estructura difiere)
import VacationRequest from '../src/models/VacationRequest.js';
import User from '../src/models/User.js';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.DB_URI ||
  'mongodb://localhost:27017/odes'; // fallback local

// Tamaño de lote para bulkWrite
const BATCH = Number(process.env.BACKFILL_BATCH_SIZE || 500);
// Modo simulación: no escribe en BD si pasas --dry
const DRY_RUN = process.argv.includes('--dry');

async function connect() {
  if (!MONGODB_URI) {
    throw new Error('No se encontró MONGODB_URI en variables de entorno');
  }
  await mongoose.connect(MONGODB_URI, {
    // opciones sensatas; ajusta si usas otra versión de driver
    autoIndex: false,
  });
  console.log(`[backfill] Conectado a ${MONGODB_URI}`);
}

async function run() {
  await connect();

  // Filtramos SOLO aprobadas y con snapshot faltante (campo ausente), para no re-procesar más tarde.
  const filter = {
    status: 'approved',
    $or: [
      { userSnapshot: { $exists: false } },
      { 'userSnapshot.name': { $exists: false } }
    ],
  };

  // Solo leemos lo necesario
  const cursor = VacationRequest.find(filter)
    .select('_id user userSnapshot')
    .cursor();

  let scanned = 0;
  let queued = 0;
  let updated = 0;
  let missingUser = 0;

  let ops = [];

  for await (const vr of cursor) {
    scanned++;

    // Busca el usuario asociado para tomar name/email
    const u = await User.findById(vr.user).select('name email').lean();

    const snapshot = {
      name: u?.name ?? null,
      email: u?.email ?? null,
    };

    if (!u) missingUser++;

    if (DRY_RUN) {
      // Solo contabilidad en dry-run
      updated++;
    } else {
      ops.push({
        updateOne: {
          filter: { _id: vr._id },
          update: { $set: { userSnapshot: snapshot } },
        },
      });
      queued++;

      if (ops.length >= BATCH) {
        const res = await VacationRequest.bulkWrite(ops, { ordered: false });
        updated += res.modifiedCount || 0;
        ops = [];
        console.log(
          `[backfill] batch aplicado | revisados: ${scanned} | actualizados: ${updated} | sin usuario: ${missingUser}`
        );
      }
    }
  }

  if (!DRY_RUN && ops.length) {
    const res = await VacationRequest.bulkWrite(ops, { ordered: false });
    updated += res.modifiedCount || 0;
  }

  console.log('---------------------------------------------');
  console.log(`[backfill] FINAL`);
  console.log(`Revisados:     ${scanned}`);
  console.log(`Actualizados:  ${updated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Sin usuario:   ${missingUser}`);
  console.log('---------------------------------------------');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[backfill] Error fatal:', err);
  process.exit(1);
});
