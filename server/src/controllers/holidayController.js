// server/src/controllers/holidayController.js
import mongoose from 'mongoose';
import Holiday from '../models/Holiday.js';
import { createAuditLog } from './auditController.js';

// Helpers de fecha
const toUTCDate = (s) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return d; // inválida
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const toYMD = (d) => new Date(d).toISOString().split('T')[0];

// ===================== CREATE =====================
export const createHoliday = async (req, res) => {
  try {
    const { name, date, recurring, description } = req.body;

    if (!name || !date) {
      return res.status(400).json({
        success: false,
        error: 'Nombre y fecha son obligatorios',
        details: {
          missingFields: {
            name: !name ? 'Campo requerido' : undefined,
            date: !date ? 'Campo requerido' : undefined,
          },
        },
      });
    }

    const dateObj = toUTCDate(date);
    if (Number.isNaN(dateObj.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Formato de fecha inválido',
        expectedFormat: 'YYYY-MM-DD',
      });
    }

    const existingHoliday = await Holiday.findOne({ date: dateObj });
    if (existingHoliday) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un festivo para esta fecha',
        existingHolidayId: existingHoliday._id,
      });
    }

    const holiday = await Holiday.create({
      name,
      date: dateObj,
      recurring: !!recurring,
      description: description || undefined,
    });

    // Auditoría
    try {
      await createAuditLog({
        user: req.user?.id,
        action: 'create_holiday',
        entity: 'Holiday',
        entityId: holiday._id,
        details: { name, date: toYMD(dateObj) },
      });
    } catch (_) {}

    return res.status(201).json({
      success: true,
      data: {
        id: String(holiday._id),
        name: holiday.name,
        date: toYMD(holiday.date),
        recurring: holiday.recurring,
        description: holiday.description,
      },
    });
  } catch (error) {
    console.error('Error al crear dia festivo:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      systemError: error.message,
    });
  }
};

// ===================== READ (rango opcional) =====================
export const getHolidays = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const q = {};
    if (startDate && endDate) {
      const start = toUTCDate(startDate);
      const end = toUTCDate(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Fechas inválidas',
          expectedFormat: 'YYYY-MM-DD',
        });
      }
      // día completo en UTC
      end.setUTCHours(23, 59, 59, 999);
      q.date = { $gte: start, $lte: end };
    }

    const items = await Holiday.find(q).sort({ date: 1 }).lean();

    return res.json({
      success: true,
      data: items.map((h) => ({
        id: String(h._id),
        name: h.name,
        date: toYMD(h.date),
        recurring: !!h.recurring,
        description: h.description || undefined,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ===================== GET UPCOMING HOLIDAYS =====================
export const getUpcomingHolidays = async (req, res) => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    // Buscar festivos en los próximos 7 días
    const upcomingHolidays = await Holiday.find({
      date: {
        $gte: today,
        $lte: nextWeek
      }
    }).sort({ date: 1 }).lean();

    return res.json({
      success: true,
      data: upcomingHolidays.map((h) => ({
        id: String(h._id),
        name: h.name,
        date: toYMD(h.date),
        recurring: !!h.recurring,
        description: h.description || undefined,
      })),
    });
  } catch (error) {
    console.error('Error al obtener festivos próximos:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
};

// ===================== UPDATE =====================
export const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, date, recurring, description } = req.body;

    const updateData = {};
    if (typeof name === 'string') updateData.name = name;
    if (typeof recurring === 'boolean') updateData.recurring = recurring;
    if (typeof description === 'string' || description === null)
      updateData.description = description || undefined;

    if (date) {
      const dateObj = toUTCDate(date);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido',
          expectedFormat: 'YYYY-MM-DD',
        });
      }
      updateData.date = dateObj;
    }

    const updatedHoliday = await Holiday.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedHoliday) {
      return res
        .status(404)
        .json({ success: false, error: 'Día festivo no encontrado' });
    }

    return res.json({
      success: true,
      data: {
        id: String(updatedHoliday._id),
        name: updatedHoliday.name,
        date: toYMD(updatedHoliday.date),
        recurring: !!updatedHoliday.recurring,
        description: updatedHoliday.description || undefined,
      },
    });
  } catch (error) {
    console.error('Error al actualizar dias festivos:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ===================== DELETE =====================
export const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isValidObjectId ? { _id: id } : { customId: id };

    const deleted = await Holiday.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Día festivo no encontrado',
        input: id,
      });
    }

    try {
      await createAuditLog({
        user: req.user?.id,
        action: 'delete_holiday',
        entity: 'Holiday',
        entityId: deleted._id,
        details: {
          name: deleted.name,
          date: toYMD(deleted.date),
          customId: deleted.customId,
        },
      });
    } catch (_) {}

    return res.json({
      success: true,
      data: {
        deleted: { id: String(deleted._id), name: deleted.name, date: toYMD(deleted.date) },
      },
    });
  } catch (error) {
    console.error('Error al eliminar día festivo:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      systemError: process.env.NODE_ENV === 'development' ? error.stack || error.message : undefined,
    });
  }
};

// ===================== TEST NOTIFICATIONS =====================
export const testHolidayNotifications = async (req, res) => {
  try {
    const { testHolidayNotifications } = await import('../services/notificationService.js');
    const result = await testHolidayNotifications();
    return res.json({
      success: true,
      message: `Prueba completada. Notificaciones enviadas: ${result}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};