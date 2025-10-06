// server/src/services/vacationService.js
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
dayjs.extend(utc)

import VacationRequest from '../models/VacationRequest.js'
import Holiday from '../models/Holiday.js'
import VacationData from '../models/VacationData.js'

// Exportado por tu utils actual (ya usabas currentAnniversaryWindow)
import { currentAnniversaryWindow, getAnnualEntitlement /* <= renombra si tu util expone otro nombre */ } from '../utils/vacationLawMX.js'

/* =========================
   Helpers de fechas en UTC
========================= */
const toDateUTC = (input) => {
  const d = new Date(input)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
const toYMDUTC = (date) => {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
const eachDayYMDUTC = (startUTC, endUTC) => {
  const out = []
  const cur = new Date(startUTC)
  const end = new Date(endUTC)
  cur.setUTCHours(0, 0, 0, 0)
  end.setUTCHours(0, 0, 0, 0)
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}
const isBusinessDay = (ymd, holidaySet) => {
  const d = toDateUTC(ymd)
  const dow = d.getUTCDay() // 0=Dom, 6=Sáb
  return dow !== 0 && dow !== 6 && !holidaySet.has(toYMDUTC(d))
}
const businessDaysInRange = (startUTC, endUTC, holidaySet) => {
  let n = 0
  for (const ymd of eachDayYMDUTC(startUTC, endUTC)) {
    if (isBusinessDay(ymd, holidaySet)) n++
  }
  return n
}

/**
 * Días USADOS en una ventana arbitraria (hábiles, sin fines ni festivos)
 * - SOLO solicitudes del usuario, estado 'approved'
 * - Intersección (solicitud ∩ ventana)
 */
async function getUsedDaysInWindow(userId, winStart, winEnd) {
  if (!userId || !winStart || !winEnd) return 0
  const startUTC = toDateUTC(winStart)
  const endUTC = toDateUTC(winEnd)

  const reqs = await VacationRequest.find({
    user: userId,
    status: 'approved',
    startDate: { $lte: endUTC },
    endDate: { $gte: startUTC },
  })
    .select('startDate endDate')
    .lean()

  if (!reqs.length) return 0

  const holidays = await Holiday.find({
    date: { $gte: startUTC, $lte: endUTC },
  })
    .select('date')
    .lean()

  const holidaySet = new Set(holidays.map((h) => toYMDUTC(h.date)))

  let used = 0
  for (const r of reqs) {
    const rs = toDateUTC(r.startDate)
    const re = toDateUTC(r.endDate)
    const isecStart = rs > startUTC ? rs : startUTC
    const isecEnd = re < endUTC ? re : endUTC
    if (isecStart > isecEnd) continue
    used += businessDaysInRange(isecStart, isecEnd, holidaySet)
  }
  return used
}

/**
 * Días USADOS en el ciclo vigente (LFT) por usuario (conservar por compatibilidad)
 * - usa la ventana devuelta por currentAnniversaryWindow(hireDate)
 */
export async function getUsedDaysInCurrentCycle(userId, hireDate) {
  if (!userId || !hireDate) return 0

  const win = currentAnniversaryWindow(hireDate) // { start: Date, end: Date }
  if (!win) return 0

  return getUsedDaysInWindow(userId, win.start, win.end)
}

/* =========================
   Ventanas (current / next)
========================= */

function computeNextWindowFromCurrent(currentWin) {
  const start = dayjs(currentWin.start).add(1, 'year').toDate()
  const end = dayjs(currentWin.end).add(1, 'year').toDate()
  return { start, end }
}

/**
 * Construye un objeto "ventana" con días por LFT para la antigüedad al inicio
 */
function buildWindow({ label, start, end, hireDate }) {
  const startD = dayjs(start)
  const endD = dayjs(end)
  const expiresAt = startD.add(18, 'month').endOf('day').toDate()
  const yearsOfServiceAtStart = Math.max(0, startD.diff(dayjs(hireDate), 'year'))

  // ⚠️ Cambia getAnnualEntitlement si tu util usa otro nombre
  const days = Number(getAnnualEntitlement ? getAnnualEntitlement(yearsOfServiceAtStart) : 0)

  return {
    year: startD.year(),
    label,
    start: startD.toDate(),
    end: endD.toDate(),
    expiresAt,
    days: Number.isFinite(days) ? days : 0,
    used: 0,
  }
}

const remainingOfWindow = (w, now = dayjs()) => {
  if (!w) return 0
  if (now.isAfter(dayjs(w.expiresAt))) return 0
  return Math.max(0, (w.days || 0) - (w.used || 0))
}

/**
 * Asegura/actualiza las dos ventanas del usuario y devuelve el summary
 * - current: aniversario más reciente <= hoy
 * - next:    siguiente aniversario
 * - ambas expiran a los 18 meses de su start
 * - "used" se recalcula a partir de solicitudes aprobadas
 * - "available" = sum(remaining no expiradas) + bonusAdmin
 * - también rellena campos legacy (total/used/remaining) para compat con UI
 */
export async function ensureWindowsAndCompute(userId, hireDate) {
  if (!userId || !hireDate) throw new Error('ensureWindowsAndCompute: userId y hireDate son requeridos')

  const now = dayjs()

  // Ventana actual segun tu util (ya probada en tu código)
  const cur = currentAnniversaryWindow(hireDate) // { start, end }
  if (!cur) throw new Error('No se pudo calcular la ventana actual LFT')

  // Siguiente ventana a partir de la actual
  const nxt = computeNextWindowFromCurrent(cur)

  // Cargar/crear documento
  let vac = await VacationData.findOne({ user: userId })
  if (!vac) vac = new VacationData({ user: userId, lftBaseDate: hireDate, windows: [] })
  if (!vac.lftBaseDate) vac.lftBaseDate = hireDate

  // Construir plantillas
  const tplCurrent = buildWindow({ label: 'current', start: cur.start, end: cur.end, hireDate })
  const tplNext = buildWindow({ label: 'next', start: nxt.start, end: nxt.end, hireDate })

  // Upsert por label conservando used si el ciclo (start) es el mismo
  const byLabel = Object.fromEntries((vac.windows || []).map((w) => [w.label, w]))
  function upsertWin(target, tpl) {
    if (!target) return { ...tpl }
    const sameStart = dayjs(target.start).isSame(dayjs(tpl.start), 'day')
    if (!sameStart) return { ...tpl } // cambio de ciclo; reinicia used
    // mismo ciclo: mantén used, pero actualiza días por si cambió tabla LFT
    return { ...tpl, used: target.used || 0 }
  }
  const newCurrent = upsertWin(byLabel.current, tplCurrent)
  const newNext = upsertWin(byLabel.next, tplNext)

  // Recalcular USED desde solicitudes aprobadas por ventana
  newCurrent.used = await getUsedDaysInWindow(userId, newCurrent.start, newCurrent.end)
  newNext.used = await getUsedDaysInWindow(userId, newNext.start, newNext.end)

  vac.windows = [newCurrent, newNext]

  // Disponibles (no contar expiradas) + bono admin
  const remCur = remainingOfWindow(newCurrent, now)
  const remNxt = remainingOfWindow(newNext, now)
  const bonus = vac.bonusAdmin || 0
  const available = remCur + remNxt + bonus

  // Campos legacy (para pantallas que aún los lean)
  // total efectivo visible: suma del año en curso + (si ya comenzó la siguiente) + bono
  const nextStarted = now.isSame(dayjs(newNext.start)) || now.isAfter(dayjs(newNext.start))
  const totalEffective = (newCurrent.days || 0) + (nextStarted ? (newNext.days || 0) : 0) + bonus
  const usedEffective = (newCurrent.used || 0) + (nextStarted ? (newNext.used || 0) : 0)

  vac.total = totalEffective
  vac.used = usedEffective
  vac.remaining = available
  vac.lastUpdate = new Date()

  await vac.save()

  return {
    userId,
    now: now.toDate(),
    bonusAdmin: bonus,
    windows: [newCurrent, newNext],
    available,
  }
}

/**
 * Atajo para obtener summary (útil en controladores)
 */
export async function getVacationSummary(userId, hireDate) {
  return ensureWindowsAndCompute(userId, hireDate)
}
