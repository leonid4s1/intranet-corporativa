// server/src/routes/api.demo.js (o el nombre que prefieras)
const express = require('express');
const router = express.Router();

const User = require('../models/User');
const News = require('../models/News');
const Task = require('../models/Task');
// Si tienes el modelo de sincronización:
let VacationData;
try { VacationData = require('../models/VacationData'); } catch (_) { /* opcional */ }

/* ============================
   DEMO / EXISTENTES
   ============================ */

// Obtener un usuario cualquiera (demo)
router.get('/user', async (req, res) => {
  try {
    const user = await User.findOne().lean({ virtuals: true });
    return res.json(user || null);
  } catch (err) {
    console.error('GET /user error:', err);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Obtener noticias
router.get('/news', async (req, res) => {
  try {
    const news = await News.find().sort({ date: -1 }).lean();
    return res.json(news);
  } catch (err) {
    console.error('GET /news error:', err);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Obtener tareas
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find().lean();
    return res.json(tasks);
  } catch (err) {
    console.error('GET /tasks error:', err);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Seed de datos de ejemplo
router.post('/seed', async (req, res) => {
  try {
    await Promise.all([User.deleteMany(), News.deleteMany(), Task.deleteMany()]);

    await User.create({
      name: 'Carlos',
      email: 'carlos@example.com',
      role: 'user',
      password: 'Password123!', // si tu modelo la requiere
      department: 'Diseño y Proyectos',
      avatar: '/ruta/a/avatar.jpg',
      unreadNotifications: 3,
      vacationDays: { total: 12, used: 2 }
    });

    await News.insertMany([
      { title: 'Nueva política de vacaciones', excerpt: 'Actualización importante...', date: new Date('2023-11-15'), department: 'Recursos Humanos' },
      { title: 'Proyecto Centro Comercial - Avance', excerpt: 'La fase 2...', date: new Date('2023-11-10'), department: 'Gerencia de Proyectos' }
    ]);

    await Task.insertMany([
      { title: 'Revisión de planos', status: 'completed' },
      { title: 'Presentación cliente', status: 'completed' },
      { title: 'Informe de avance', status: 'in-progress' },
      { title: 'Solicitud de materiales', status: 'pending' }
    ]);

    return res.send('Datos iniciales insertados');
  } catch (err) {
    console.error('POST /seed error:', err);
    return res.status(500).json({ success: false, message: 'Error haciendo seed' });
  }
});

/* ============================
   USUARIOS + VACACIONES
   ============================ */

// Lista de usuarios con días de vacaciones
router.get('/users', async (req, res) => {
  try {
    // Preferimos leer desde User (tienes virtual remaining). Si usas VacationData, se une debajo.
    const users = await User.find()
      .select('name email role isActive isVerified email_verified_at createdAt vacationDays')
      .lean({ virtuals: true })
      .exec();

    if (VacationData) {
      const vdata = await VacationData.find().lean().exec();
      const vmap = new Map(vdata.map(v => [String(v.user), v]));
      const merged = users.map(u => {
        const vd = vmap.get(String(u._id));
        const total = vd ? vd.total : u?.vacationDays?.total ?? 0;
        const used = vd ? vd.used : u?.vacationDays?.used ?? 0;
        const remaining = vd ? vd.remaining : Math.max(0, total - used);
        return {
          id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          isVerified: !!u.isVerified,
          email_verified_at: u.email_verified_at || null,
          createdAt: u.createdAt,
          vacationDays: { total, used, remaining }
        };
      });
      return res.json({ success: true, data: merged });
    }

    // Sin VacationData, solo desde User
    const data = users.map(u => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      isVerified: !!u.isVerified,
      email_verified_at: u.email_verified_at || null,
      createdAt: u.createdAt,
      vacationDays: {
        total: u?.vacationDays?.total ?? 0,
        used: u?.vacationDays?.used ?? 0,
        remaining: Math.max(0, (u?.vacationDays?.total ?? 0) - (u?.vacationDays?.used ?? 0))
      }
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('GET /users error:', err);
    return res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
});

// Establecer el TOTAL exacto de días disponibles
router.patch('/users/:id/vacation/total', async (req, res) => {
  try {
    const { id } = req.params;
    const { total } = req.body;

    if (total == null || isNaN(total) || Number(total) < 0) {
      return res.status(400).json({ success: false, message: 'total debe ser un número >= 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // Método de instancia que ya definiste en tu schema
    if (typeof user.setVacationDays === 'function') {
      await user.setVacationDays(Number(total));
    } else {
      // Fallback por si no está el método
      user.vacationDays = user.vacationDays || {};
      user.vacationDays.total = Math.floor(Number(total));
      user.vacationDays.lastUpdate = new Date();
      await user.save();
    }

    return res.json({ success: true, message: 'Días de vacaciones (total) actualizados', data: user.vacationDays });
  } catch (err) {
    console.error('PATCH /users/:id/vacation/total error:', err);
    return res.status(500).json({ success: false, message: 'Error actualizando días' });
  }
});

// (Opcional) Sumar N días al total actual
router.post('/users/:id/vacation/add', async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (days == null || isNaN(days) || Number(days) <= 0) {
      return res.status(400).json({ success: false, message: 'days debe ser un entero > 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (typeof user.addVacationDays === 'function') {
      await user.addVacationDays(Number(days));
    } else {
      user.vacationDays = user.vacationDays || { total: 0, used: 0 };
      user.vacationDays.total += Math.floor(Number(days));
      user.vacationDays.lastUpdate = new Date();
      await user.save();
    }

    return res.json({ success: true, message: 'Días añadidos', data: user.vacationDays });
  } catch (err) {
    console.error('POST /users/:id/vacation/add error:', err);
    return res.status(500).json({ success: false, message: 'Error añadiendo días' });
  }
});

// (Opcional) Establecer directamente los días USADOS
router.patch('/users/:id/vacation/used', async (req, res) => {
  try {
    const { id } = req.params;
    const { used } = req.body;

    if (used == null || isNaN(used) || Number(used) < 0) {
      return res.status(400).json({ success: false, message: 'used debe ser un número >= 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    user.vacationDays = user.vacationDays || { total: 0, used: 0 };
    user.vacationDays.used = Math.floor(Number(used)); // tu schema ya valida que no exceda total
    user.vacationDays.lastUpdate = new Date();
    await user.save();

    return res.json({ success: true, message: 'Días usados actualizados', data: user.vacationDays });
  } catch (err) {
    console.error('PATCH /users/:id/vacation/used error:', err);
    return res.status(500).json({ success: false, message: 'Error actualizando días usados' });
  }
});

module.exports = router;
