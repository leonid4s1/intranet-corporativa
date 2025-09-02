// server/scripts/migrationScript.js
import mongoose from "mongoose";
import User from '../src/models/User.js';
import VacationData from "../src/models/VacationData.js";
import dotenv from 'dotenv';

dotenv.config();

async function migrateVacationData() {
    try {
        console.log('🔃 Iniciando migración de datos de vacaciones...');

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const totalUsers = await User.countDocuments();
        console.log(`📊 Total de usuarios encontrados: ${totalUsers}`);

        const users = await User.find().cursor();

        let processed = 0;
        let created = 0;
        let skipped = 0;

        for await (const user of users) {
            processed++;

            const exists = await VacationData.exists({ user: user._id });

            if (!exists) {
                await VacationData.create({
                    user: user._id,
                    total: user.vacationDays?.total || 0,
                    used: user.vacationDays?.used || 0,
                    remaining: (user.vacationDays?.total || 0) - (user.vacationDays?.used || 0),
                    createdAt: user.createdAt,
                    updatedAt: new Date()
                });
                created++;
                process.stdout.write(`➕ Registro creado para ${user.email}\r`);
            } else {
                skipped++;
            }

            // Mostrar proceso cada 10 usuarios
            if (processed % 10 === 0) {
                console.log(`🔄 Procesados ${processed}/${totalUsers} usuarios...`);
            }
        }

        console.log('\n✅ Migración completada con éxito');
        console.log(`✔ Total procesados: ${processed}`);
        console.log(`✔ Nuevos registros creados: ${created}`);
        console.log(`✔ Registros existentes omitidos: ${skipped}`);

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error durante la migración:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

// Ejecutar solo si el llamado directamente ( no cuando se importa)
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateVacationData();
}