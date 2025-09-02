// server/src/controllers/holidayController.js
import mongoose from "mongoose";
import Holiday from "../models/Holiday.js";
import { createAuditLog } from './auditController.js'

// Crear un nuevo dia festivo
export const createHoliday = async (req, res) => {
    try {
        const { name, date, recurring, description } = req.body;

        // Validacion mejorada
        if (!name || !date) {
            return res.status(400).json({
                success: false,
                error: 'Nombre y fecha son obligatorios',
                details: {
                    missingFields: {
                        name: !name ? 'Campo requerido' : undefined,
                        date: !date ? 'Campo requerido' : undefined
                    }
                }
            });
        }

        // Validar formato de fecha
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Formato de fecha inválido',
                expectedFormat: 'YYYY-MM-DD'
            });
        }
        // Fijar la hora a medianoche UTC para evitar desfase
        dateObj.setUTCHours(0, 0, 0, 0);

        // Verificar si ya existe un festivo para esa fecha
        const existingHoliday = await Holiday.findOne({ date: dateObj });
        if (existingHoliday) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe un festivo para esta fecha',
                existingHolidayId: existingHoliday._id
            });
        }

        const holiday = new Holiday({
            name,
            date: dateObj,
            recurring: recurring ?? false,
            description: description || undefined
        });

        await holiday.save();
        
        // Auditoria
        await createAuditLog({
            user: req.user.id,
            action: 'create_holiday',
            entity: 'Holiday',
            entityId: holiday._id,
            details: { name, date: dateObj.toISOString() }
        });

        res.status(201).json({
            success: true,
            data: {
                id: holiday._id,
                name: holiday.name,
                date: holiday.date.toISOString().split('T')[0],
                recurring: holiday.recurring,
                description: holiday.description
            }
        });
    } catch (error) {
        console.error('Error al crear dia festivo:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            systemError: error.message
        });
    }
};

// Obtener todos los dias festivos (con filtro por rango de fechas)
export const getHolidays = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            start.setUTCHours(0, 0, 0, 0);
            end.setUTCHours(23, 59, 59, 999);

            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const holidays = await Holiday.find(query)
            .sort({ date: 1 })
            .lean();

        res.json({
            success: true,
            data: holidays
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Actualizar un dia festivo
export const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, recurring, description } = req.body;

    let dateObj;
    if (date) {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido',
          expectedFormat: 'YYYY-MM-DD'
        });
      }
      // Fijar la hora a medianoche UTC
      dateObj.setUTCHours(0, 0, 0, 0);
    }

    const updateData = {
      name,
      recurring,
      description
    };

    if (dateObj) {
      updateData.date = dateObj;
    }

    const updateHoliday = await Holiday.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updateHoliday) {
      return res.status(404).json({ error: 'Dia festivo no encontrado' });
    }

    res.json({ success: true, data: updateHoliday });
  } catch (error) {
    console.error('Error al actualizar dias festivos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Eliminar un dia festivo
export const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;

        const isValidObjectId = mongoose.Types.ObjectId.isValid(id);

        const filter = isValidObjectId
            ? { _id: id }
            : { customId: id };

        const deleted = await Holiday.findOneAndDelete(filter);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Día festivo no encontrado',
                input: id,
                suggestions: await Holiday.find({
                    $or: [
                        { name: { $regex: id, $options: 'i' } },
                        { customId: { $regex: id, $options: 'i' } }
                    ]
                }).limit(5)
            });
        }

        // Auditoría
        await createAuditLog({
            user: req.user.id,
            action: 'delete_holiday',
            entity: 'Holiday',
            entityId: deleted._id,
            details: {
                name: deleted.name,
                date: deleted.date,
                customId: deleted.customId
            }
        });

        res.json({
            success: true,
            data: {
                deleted: {
                    id: deleted._id,
                    customId: deleted.customId,
                    name: deleted.name
                },
                remaining: await Holiday.countDocuments()
            }
        });
    } catch (error) {
        console.error('Error al eliminar día festivo:', error);

        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            systemError: process.env.NODE_ENV === 'development' ? error.stack || error.message : undefined,
            docs: 'https://api.tudominio.com/docs/errors#holiday-deletion'
        });
    }
};