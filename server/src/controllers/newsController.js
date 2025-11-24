// server/src/controllers/newsController.js (ESM)
import News from '../models/News.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { startOfDay, addDays, isAfter, differenceInCalendarDays } from 'date-fns';
import { notifyAllUsersAboutAnnouncement } from '../services/notificationService.js'; // ⬅️ mails anuncio

const MX_TZ = 'America/Mexico_City';

/* =========================
 *        Helpers MX
 * ========================= */

// "Hoy" a las 00:00 en MX
function startOfDayInMX(date = new Date()) {
  const local = new Date(new Date(date).toLocaleString('en-US', { timeZone: MX_TZ }));
  return startOfDay(local);
}

// Fecha/hora actual en MX
function nowInMX(d = new Date()) {
  return new Date(new Date(d).toLocaleString('en-US', { timeZone: MX_TZ }));
}

// mm-dd HOY (usamos UTC, alineado a cómo se guardan las fechas de nacimiento)
function mmddTodayMX() {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// mm-dd de una fecha de nacimiento (UTC)
function mmddFromBirthDate(date) {
  const d = new Date(date);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// mm-dd en zona MX genérico (queda por si lo necesitas en el futuro)
function mmddMX(date = new Date()) {
  const n = nowInMX(date);
  const mm = n.toLocaleString('en-CA', { timeZone: MX_TZ, month: '2-digit' });
  const dd = n.toLocaleString('en-CA', { timeZone: MX_TZ, day: '2-digit' });
  return `${mm}-${dd}`;
}

function toISO(d) {
  return new Date(d).toISOString();
}

// Parse robusto de Holiday.date -> Date
function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

// Ancla Y-M-D (UTC) al mediodía UTC y lo lleva a 00:00 MX del mismo día
function mxMidnightOfUTCDate(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const atNoonUTC = new Date(Date.UTC(y, m, day, 12));
  return startOfDayInMX(atNoonUTC);
}

// Detecta si es recurrente: true | "recurring" | "recurrente" | "recurrencia" | etc.
function isRecurringFlag(h) {
  if (h?.recurring === true) return true;
  const t = String(h?.type || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  return (
    t === 'recurring' ||
    t === 'recurrente' ||
    t === 'recurrent' ||
    t === 'recurrencia'
  );
}

/**
 * Próxima ocurrencia (00:00 MX):
 * - Único: respeta el año guardado
 * - Recurrente: misma mm-dd este año o siguiente si ya pasó (robusto a TZ)
 */
function nextOccurrenceMX(holidayDate, isRecurring) {
  const base = toDate(holidayDate);
  const todayMX = startOfDayInMX();

  if (!isRecurring) {
    return mxMidnightOfUTCDate(base);
  }

  const mm = base.getUTCMonth();
  const dd = base.getUTCDate();

  const occThisUTCNoon = new Date(Date.UTC(todayMX.getUTCFullYear(), mm, dd, 12));
  let occMX = startOfDayInMX(occThisUTCNoon);

  if (isAfter(todayMX, occMX)) {
    const occNextUTCNoon = new Date(Date.UTC(todayMX.getUTCFullYear() + 1, mm, dd, 12));
    occMX = startOfDayInMX(occNextUTCNoon);
  }
  return occMX;
}

// Ventana 08:00–19:00 MX
function isBetween8and19MX(d = new Date()) {
  const h = nowInMX(d).getHours(); // 0–23
  return h >= 8 && h < 19;
}

function eightAMMX(d = new Date()) {
  const n = startOfDayInMX(d);
  n.setHours(8, 0, 0, 0);
  return n;
}
function sevenPMMX(d = new Date()) {
  const n = startOfDayInMX(d);
  n.setHours(19, 0, 0, 0);
  return n;
}

/* =========================
 *      Controller Home
 * ========================= */

// Renombrado: getHomeFeed -> getHomeNews
export const getHomeNews = async (req, res, next) => {
  try {
    const today = startOfDayInMX();

    // 🔒 Anti-cache
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('ETag', `homefeed-${today.toISOString().slice(0, 10)}`);

    // 1) Noticias publicadas (mínimo) — excluye tipo legacy holiday_notification
    const published = await News.find(
      { status: 'published', type: { $ne: 'holiday_notification' } },
      {
        title: 1,
        body: 1,
        excerpt: 1,
        visibleFrom: 1,
        visibleUntil: 1,
        createdAt: 1,
        type: 1,
        imageUrl: 1,
        ctaText: 1,
        ctaTo: 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const items = (published || []).map((n) => ({
      id: String(n._id),
      type: n.type || 'static',
      title: n.title || 'Aviso',
      body: n.body || '',
      excerpt: n.excerpt || '',
      imageUrl: n.imageUrl || null,
      ctaText: n.ctaText || null,
      ctaTo: n.ctaTo || null,
      visibleFrom: n.visibleFrom ? toISO(n.visibleFrom) : undefined,
      visibleUntil: n.visibleUntil ? toISO(n.visibleUntil) : undefined,
    }));

    // 2) Días festivos: ventana 7d + fallback por proximidad
    const holidays = await Holiday.find(
      {},
      { name: 1, date: 1, recurring: 1, type: 1 }
    ).lean();

    for (const h of holidays) {
      if (!h?.date || !h?.name) continue;

      const recurring = isRecurringFlag(h);
      const occStart = nextOccurrenceMX(h.date, recurring); // 00:00 MX del día de la ocurrencia
      const windowStart = addDays(occStart, -7);
      const windowEndExclusive = addDays(occStart, 1);

      const inWindow = today >= windowStart && today < windowEndExclusive;

      // Fallback: si faltan de 0 a 7 días, mostrarlo igual (cubrir edge TZ)
      const diff = differenceInCalendarDays(occStart, today); // MX vs MX
      const fallbackHit = !inWindow && diff >= 0 && diff <= 7;

      if (inWindow || fallbackHit) {
        // Evita duplicar si ya existe una notificación para este festivo
        const existingHolidayNotification = items.find(
          (item) => item.type === 'holiday_notice' && item.title.includes(h.name)
        );

        if (!existingHolidayNotification) {
          items.unshift({
            id: `holiday-${String(h._id)}-${occStart.getFullYear()}`,
            type: 'holiday_notice',
            title: `Próximo día festivo: ${h.name}`,
            body: `Se celebra el ${new Date(occStart).toLocaleDateString('es-MX', {
              timeZone: MX_TZ,
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}.`,
            visibleFrom: toISO(windowStart),
            visibleUntil: toISO(windowEndExclusive),
          });

          // Email único al entrar a la ventana de 7 días
          try {
            const svc = await import('../services/notificationService.js');
            const fn = svc?.sendUpcomingHolidayEmailIfSevenDaysBefore;
            if (typeof fn === 'function') {
              await fn({ ...h, date: occStart });
            } else {
              console.warn(
                '[holiday_notice] sendUpcomingHolidayEmailIfSevenDaysBefore no está exportada.'
              );
            }
          } catch (errMail) {
            console.error(
              '[holiday_notice 7d] error enviando correo:',
              errMail?.message || errMail
            );
          }
        }
      }
    }

    // 3) Cumpleaños (solo digest, no requiere login del cumpleañero)
    {
      const todayMMDD_MX = mmddTodayMX();

      // Calcular cumpleañeros de HOY (por fecha de nacimiento)
      const all = await User.find(
        { birthDate: { $ne: null } },
        { name: 1, email: 1, birthDate: 1 }
      ).lean();

      const birthdayTodayUsers = all.filter(
        (u) => u.birthDate && mmddFromBirthDate(u.birthDate) === todayMMDD_MX
      );

      console.log(
        '[birthdays][home] todayMMDD',
        todayMMDD_MX,
        'count',
        birthdayTodayUsers.length,
        'users',
        birthdayTodayUsers.map((u) => `${u.name} <${u.email}>`)
      );

      if (birthdayTodayUsers.length > 0) {
        // Disparar correo único (a las 08:00 lo hace el cron; aquí es respaldo idempotente)
        try {
          const svc = await import('../services/notificationService.js');
          const fn = svc?.sendBirthdayEmailsIfDue; // idempotente por DailyLock v2
          if (typeof fn === 'function') {
            await fn();
          }
        } catch (errMail) {
          console.error(
            '[birthdays] error enviando correos:',
            errMail?.message || errMail
          );
        }

        // Mostrar tarjeta SOLO entre 08:00–19:00 MX
        if (isBetween8and19MX()) {
          const names = birthdayTodayUsers
            .map((u) => u.name || u.email)
            .join(', ');

          items.unshift({
            id: `birthday-digest-${todayMMDD_MX}`,
            type: 'birthday_digest_info',
            title: 'Cumpleaños de hoy',
            body: `Hoy celebramos a: ${names}. ¡Felicítenl@s! 🎂`,
            visibleFrom: toISO(eightAMMX(today)),
            visibleUntil: toISO(sevenPMMX(today)),
          });
        }
      }
    }

    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

// Alias para compatibilidad
export const getHomeFeed = getHomeNews;

/* =========================
 *   ADMIN: Comunicados
 * ========================= */

/**
 * Crea un comunicado de tipo "announcement".
 * - Acepta imagen (multer la deja en req.file)
 * - Envía correo a toda la empresa
 */
export const createAnnouncement = async (req, res, next) => {
  try {
    const {
      title,
      body,
      excerpt,
      ctaText,
      ctaTo,
      visibleFrom,
      visibleUntil,
      status = 'published',
      isActive = true,
      priority = 'medium',
    } = req.body;

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const news = await News.create({
      type: 'announcement',
      title: String(title || '').trim(),
      body: String(body || excerpt || title || '').trim(),
      excerpt: excerpt ? String(excerpt).trim() : undefined,
      imageUrl,
      ctaText: ctaText ? String(ctaText).trim() : null,
      ctaTo: ctaTo ? String(ctaTo).trim() : null,
      visibleFrom: visibleFrom ? new Date(visibleFrom) : new Date(),
      visibleUntil: visibleUntil ? new Date(visibleUntil) : null, // exclusivo
      status,
      isActive,
      priority,
      createdBy: req.user?._id || null,
    });

    // correos a toda la empresa (fire-and-forget)
    try {
      const recipients = await User.find({
        email: { $ne: null },
      })
        .select('email name')
        .lean();
      await notifyAllUsersAboutAnnouncement(recipients, news);
    } catch (mailErr) {
      console.error('[announcement email] error:', mailErr?.message || mailErr);
    }

    res.status(201).json({ ok: true, data: news });
  } catch (err) {
    next(err);
  }
};

/**
 * Lista comunicados (para Admin o vista de gestión).
 * Query opcional:
 *   - ?all=true  -> devuelve todos (ignora ventana de visibilidad)
 *
 * Cada item incluye:
 *   - published: boolean => si está actualmente publicado / visible
 */
export const listAnnouncements = async (req, res, next) => {
  try {
    const all = req.query.all === 'true';
    const now = new Date();

    const filter = { type: 'announcement' };

    if (!all) {
      // Solo los visibles y activos para vista pública
      filter.$or = [
        { visibleUntil: null, visibleFrom: { $lte: now } },
        { visibleFrom: { $lte: now }, visibleUntil: { $gt: now } },
      ];
      filter.status = 'published';
      filter.isActive = true;
    }

    const raw = await News.find(filter).sort({ visibleFrom: -1 }).lean();

    const items = raw.map((n) => {
      const visibleFrom = n.visibleFrom ? new Date(n.visibleFrom) : null;
      const visibleUntil = n.visibleUntil ? new Date(n.visibleUntil) : null;

      const isCurrentlyPublished =
        n.status === 'published' &&
        (n.isActive ?? true) &&
        (!visibleFrom || visibleFrom <= now) &&
        (!visibleUntil || visibleUntil > now);

      return {
        ...n,
        id: String(n._id),
        published: isCurrentlyPublished,
      };
    });

    res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualiza un comunicado existente.
 * Se limita a campos permitidos.
 * Si viene archivo (req.file) se actualiza imageUrl.
 */
export const updateAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      title,
      body,
      excerpt,
      ctaText,
      ctaTo,
      visibleFrom,
      visibleUntil,
      status,
      isActive,
      priority,
    } = req.body;

    const updateData = {};

    if (title !== undefined) updateData.title = String(title).trim();
    if (body !== undefined) updateData.body = String(body).trim();
    if (excerpt !== undefined) updateData.excerpt = String(excerpt).trim();
    if (ctaText !== undefined)
      updateData.ctaText = ctaText ? String(ctaText).trim() : null;
    if (ctaTo !== undefined)
      updateData.ctaTo = ctaTo ? String(ctaTo).trim() : null;

    if (visibleFrom !== undefined) {
      updateData.visibleFrom = visibleFrom ? new Date(visibleFrom) : null;
    }
    if (visibleUntil !== undefined) {
      updateData.visibleUntil = visibleUntil ? new Date(visibleUntil) : null;
    }

    if (status !== undefined) updateData.status = status;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;

    // Si suben nueva imagen
    if (req.file) {
      updateData.imageUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await News.findOneAndUpdate(
      { _id: id, type: 'announcement' },
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, message: 'Comunicado no encontrado' });
    }

    res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
};

/**
 * Elimina (despublica definitivamente) un comunicado.
 */
export const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;

    const deleted = await News.findOneAndDelete({
      _id: id,
      type: 'announcement',
    }).lean();

    if (!deleted) {
      return res
        .status(404)
        .json({ ok: false, message: 'Comunicado no encontrado' });
    }

    // 204: No Content
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
