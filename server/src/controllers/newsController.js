// server/src/controllers/newsController.js (ESM)
import News from '../models/News.js';
import Holiday from '../models/Holiday.js';
import User from '../models/User.js';
import { startOfDay, addDays, isAfter, differenceInCalendarDays } from 'date-fns';
import { notifyAllUsersAboutAnnouncement } from '../services/notificationService.js'; // ⬅️ NUEVO

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

// mm-dd en zona MX (para cumpleaños)
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
  return t === 'recurring' || t === 'recurrente' || t === 'recurrent' || t === 'recurrencia';
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
    const user = req.user;
    const today = startOfDayInMX();

    // 🔒 Anti-cache
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('ETag', `homefeed-${today.toISOString().slice(0, 10)}`);

    // 1) Noticias publicadas (mínimo) - INCLUYENDO holiday_notification
    const published = await News.find(
      {
        $or: [
          { status: 'published' },
          { type: 'holiday_notification', isActive: true }, // incluir notificaciones de festivos
        ],
      },
      { title: 1, body: 1, excerpt: 1, visibleFrom: 1, visibleUntil: 1, createdAt: 1, type: 1, imageUrl: 1, ctaText: 1, ctaTo: 1 }
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
    const holidays = await Holiday.find({}, { name: 1, date: 1, recurring: 1, type: 1 }).lean();

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
              console.warn('[holiday_notice] sendUpcomingHolidayEmailIfSevenDaysBefore no está exportada.');
            }
          } catch (errMail) {
            console.error('[holiday_notice 7d] error enviando correo:', errMail?.message || errMail);
          }
        }
      }
    }

    // 3) Cumpleaños (digest + self) — independiente de login y SOLO 08–19 MX
    {
      const todayMMDD_MX = mmddMX(today);

      // Calcular cumpleañeros de HOY en MX
      const all = await User.find(
        { birthDate: { $ne: null } },
        { name: 1, email: 1, birthDate: 1 }
      ).lean();

      const birthdayTodayUsers = all.filter(
        (u) => u.birthDate && mmddMX(u.birthDate) === todayMMDD_MX
      );

      // Disparar correo único (a las 08:00 lo hace el cron; aquí es respaldo idempotente)
      if (birthdayTodayUsers.length > 0) {
        try {
          const svc = await import('../services/notificationService.js');
          const fn = svc?.sendBirthdayEmailsIfDue; // idempotente por DailyLock
          if (typeof fn === 'function') {
            await fn();
          }
        } catch (errMail) {
          console.error('[birthdays] error enviando correos:', errMail?.message || errMail);
        }
      }

      // Pintar tarjetas SOLO entre 08:00–19:00 MX
      if (isBetween8and19MX()) {
        // Card personal si ES su cumpleaños y está logueado
        if (user) {
          const me = await User.findById(user.id).lean();
          const isMyBirthday = !!me?.birthDate && mmddMX(me.birthDate) === todayMMDD_MX;

          if (isMyBirthday) {
            const first = (me?.name || 'colaborador').split(' ')[0];
            items.unshift({
              id: `birthday-self-${String(me._id)}-${todayMMDD_MX}`,
              type: 'birthday_self',
              title: `¡Feliz cumpleaños, ${first}!`,
              body: 'Te deseamos un día increíble. 🎉',
              visibleFrom: toISO(eightAMMX(today)),
              visibleUntil: toISO(sevenPMMX(today)),
            });
          }
        }

        // Digest visible para TODOS (no depende de que el cumpleañero inicie sesión)
        if (birthdayTodayUsers.length > 0) {
          const names = birthdayTodayUsers.map((u) => u.name || u.email).join(', ');
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
      priority = 'medium'
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
      createdBy: req.user?._id || null
    });

    // correos a toda la empresa (fire-and-forget)
    try {
      const recipients = await User.find({ email: { $ne: null } }).select('email name').lean();
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
 * Lista comunicados visibles (para Admin o vista de gestión).
 * Query opcional:
 *   - ?all=true  -> devuelve todos (ignora ventana de visibilidad)
 */
export const listAnnouncements = async (req, res, next) => {
  try {
    const all = req.query.all === 'true';
    const now = new Date();

    const filter = { type: 'announcement' };
    if (!all) {
      filter.$or = [
        { visibleUntil: null, visibleFrom: { $lte: now } },
        { visibleFrom: { $lte: now }, visibleUntil: { $gt: now } },
      ];
      filter.status = 'published';
      filter.isActive = true;
    }

    const items = await News.find(filter)
      .sort({ visibleFrom: -1 })
      .lean();

    res.json({ ok: true, data: items });
  } catch (err) {
    next(err);
  }
};
