<template>
  <div class="vacations-page">
    <!-- Toast -->
    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <!-- Días disponibles -->
      <div class="kpi-card">
        <div class="kpi-value">{{ availableDays }}</div>
        <div class="kpi-label">Días disponibles</div>
        <div class="kpi-bar">
          <div
            class="kpi-bar-fill"
            :style="{ width: totalAnnualDays ? Math.min(100, Math.round((availableDays / totalAnnualDays) * 100)) + '%' : '0%' }"
          />
        </div>
      </div>

      <!-- Días usados -->
      <div class="kpi-card">
        <div class="kpi-value">{{ usedDays }}</div>
        <div class="kpi-label">Días usados</div>
        <small v-if="totalAnnualDays">{{ Math.round((usedDays / totalAnnualDays) * 100) }}% del total</small>
      </div>

      <!-- Días anuales -->
      <div class="kpi-card">
        <div class="kpi-value">{{ totalAnnualDays }}</div>
        <div class="kpi-label">Días anuales</div>
        <small>{{ availableDays }} días restantes</small>
      </div>

      <!-- Periodo vigente (mejorado) -->
      <div class="kpi-card kpi-period">
        <div class="period-dates">
          <template v-if="windowStart && windowEnd">
            <span class="date">{{ windowStartFmt }}</span>
            <span class="arrow">→</span>
            <span class="date">{{ windowEndFmt }}</span>
          </template>
          <template v-else>—</template>
        </div>
        <div class="kpi-label">Periodo vigente</div>
        <small class="badge-soft" v-if="windowEnd">{{ daysLeft }} días restantes</small>
        <div class="kpi-bar period-bar">
          <div class="kpi-bar-fill period-fill" :style="{ width: periodPct + '%' }" />
        </div>
      </div>
    </div>

    <div class="content-grid">
      <!-- Calendario -->
      <section class="calendar-card">
        <header class="calendar-header">
          <button class="nav-btn" @click="goPrevMonth">‹</button>
          <h2 class="month-title">{{ currentDate.format('MMMM YYYY') }}</h2>
          <button class="nav-btn" @click="goNextMonth">›</button>
        </header>

        <div class="legend">
          <span><span class="dot dot--green" /> Disponible</span>
          <span><span class="dot dot--yellow" /> Festivo / Fin de semana</span>
          <span><span class="dot dot--red" /> Cupo lleno</span>
          <span v-if="selectedStart || selectedEnd"><span class="dot dot--blue" /> Selección</span>
        </div>

        <div class="weekday-row">
          <div v-for="d in weekDayNames" :key="d" class="weekday-cell">{{ d }}</div>
        </div>

        <div class="calendar-grid">
          <div
            v-for="day in calendarDays"
            :key="day.date"
            class="day-cell"
            :class="{
              'is-other-month': !day.isCurrentMonth,
              'is-today': day.isToday,
              'is-weekend': day.isWeekend,
              'is-holiday': day.isHoliday,
              'is-full': day.isFull,
              'is-selected': day.inSelection,
              'is-available': !day.isFull && !day.isHoliday && !day.isWeekend && !day.inSelection && day.isAvailable,
              'has-holiday-name': !!day.holidayName,
              'has-team-approved': day.hasTeamApproved
            }"
            :title="getDayTooltip(day)"
            @click="onClickDay(day)"
            @mouseenter="onHoverDay(day)"
          >
            <div class="badges">
              <span
                v-if="day.isHoliday"
                class="badge badge--holiday"
                :title="day.holidayName ? 'Festivo: ' + day.holidayName : 'Festivo'"
              >Festivo</span>

              <span
                v-else-if="day.isWeekend"
                class="badge badge--weekend"
                title="Fin de semana"
              >Fin de semana</span>

              <span
                v-if="day.teamCount > 0"
                class="badge badge--count"
                :class="{ 'is-full': day.isFull }"
                :title="day.isFull ? `Cupo lleno (${day.teamCount}/${MAX_PER_DAY})` : `${day.teamCount} en vacaciones`"
              >
                {{ day.teamCount }}/{{ MAX_PER_DAY }}
              </span>
            </div>

            <div class="day-number">{{ day.day }}</div>

            <div class="labels" v-if="day.hasTeamApproved">
              <span
                v-for="(n, i) in day.topTwoNames"
                :key="i"
                class="chip chip--approved"
                :title="day.approvedNamesFull"
              >{{ n }}</span>
              <span
                v-if="day.extraCount > 0"
                class="chip chip--approved more"
                :title="day.approvedNamesFull"
              >+{{ day.extraCount }}</span>
            </div>

            <span
              v-if="day.isFull || day.isHoliday || day.isWeekend || day.inSelection || day.isAvailable"
              class="dot"
              :class="{
                'dot--red': day.isFull,
                'dot--yellow': !day.isFull && (day.isHoliday || day.isWeekend),
                'dot--blue': !day.isFull && !day.isHoliday && !day.isWeekend && day.inSelection,
                'dot--green': !day.isFull && !day.isHoliday && !day.isWeekend && !day.inSelection && day.isAvailable
              }"
            />
          </div>
        </div>
      </section>

      <!-- Panel derecho -->
      <aside class="side-panels">
        <section class="panel">
          <h3>Instrucciones</h3>
          <ol class="instructions">
            <li>Selecciona el primer día (no se permite el día de hoy).</li>
            <li>Selecciona el último día (hover para previsualizar).</li>
            <li>El diálogo se abrirá automáticamente.</li>
          </ol>
        </section>

        <section class="panel">
          <h3>Próximas solicitudes</h3>
          <div v-if="pendingRequests.length === 0" class="muted">No tienes solicitudes pendientes</div>
          <div v-else class="requests">
            <div v-for="req in pendingRequests" :key="req._id" class="request-row">
              <div>
                {{ formatDate(req.startDate) }} - {{ formatDate(req.endDate) }}<br />
                <small class="muted">{{ pluralizeDays(req.daysRequested || countBusinessDays(req.startDate, req.endDate)) }}</small>
                <template v-if="req.reason">
                  <br /><small class="muted">Motivo: {{ req.reason }}</small>
                </template>
              </div>
              <div class="actions">
                <button class="btn btn-danger" :disabled="!canCancel(req.startDate)" @click="cancel(req._id)">Cancelar</button>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <h3>Vacaciones aprobadas</h3>
          <div v-if="approvedRequests.length === 0" class="muted">No tienes vacaciones aprobadas</div>
          <div v-else class="requests">
            <div
              v-for="req in approvedRequests"
              :key="req._id"
              class="request-row"
              :class="{ expired: isPast(req.endDate) }"
            >
              <div>
                {{ formatDate(req.startDate) }} - {{ formatDate(req.endDate) }}<br />
                <small class="muted">{{ pluralizeDays(req.daysRequested || countBusinessDays(req.startDate, req.endDate)) }}</small>
                <template v-if="req.reason">
                  <br /><small class="muted">Motivo: {{ req.reason }}</small>
                </template>
              </div>
              <div class="actions">
                <span class="badge badge-success">Aprobada</span>
                <button
                  v-if="!isPast(req.endDate) && canCancel(req.startDate)"
                  class="btn btn-danger ml-2"
                  @click="cancel(req._id)"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <h3>Solicitudes rechazadas</h3>
          <div v-if="latestRejected.length === 0" class="muted">No tienes solicitudes rechazadas</div>
          <div v-else class="requests">
            <div v-for="req in latestRejected" :key="req._id" class="request-row">
              <div>
                {{ formatDate(req.startDate) }} - {{ formatDate(req.endDate) }}<br />
                <small class="muted">{{ pluralizeDays(req.daysRequested || countBusinessDays(req.startDate, req.endDate)) }}</small>
                <template v-if="req.rejectReason || req.reason">
                  <br />
                  <small class="muted">
                    <strong>Motivo del rechazo:</strong> {{ req.rejectReason || req.reason }}
                  </small>
                </template>
              </div>
              <div class="actions">
                <span class="badge" style="background:#fee2e2; color:#991b1b;">Rechazada</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <!-- Diálogo -->
    <VacationRequestDialog
      v-if="requestOpen && selectedStart && selectedEnd"
      :start-date="selectedStart"
      :end-date="selectedEnd"
      :business-days="selectedBusinessDays"
      :remaining-days="Math.max(0, availableDays - selectedBusinessDays)"
      @confirm="submitVacationRequest"
      @cancel="handleDialogCancel"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/es' // para formato en español
import VacationRequestDialog from '@/components/vacations/VacationRequestDialog.vue'
import {
  getVacationBalance,
  getHolidays,
  getUserVacations,
  getTeamVacations,
  getUnavailableDates,
  cancelVacationRequest,
  requestVacation,
  getMyEntitlement,
} from '@/services/vacation.service'

dayjs.locale('es')

type UserRef = { id?: string; _id?: string; name?: string }
type TeamVacation = { startDate: string; endDate: string; user?: UserRef }
type Holiday = { date: string; name?: string }
type VacationRequest = {
  _id: string
  startDate: string
  endDate: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason?: string
  rejectReason?: string
  daysRequested?: number
  createdAt?: string
  updatedAt?: string
}
type VacationBalance = { availableDays: number; usedDays: number; totalAnnualDays: number }

const MAX_PER_DAY = 3
const weekDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const currentDate = ref<Dayjs>(dayjs())
const availableDays = ref(0)
const usedDays = ref(0)
const totalAnnualDays = ref(0)

// Ventana vigente
const windowStart = ref<string>('') // YYYY-MM-DD
const windowEnd   = ref<string>('') // YYYY-MM-DD
const windowStartFmt = computed(() => windowStart.value ? dayjs(windowStart.value).format('DD MMM YYYY') : '')
const windowEndFmt   = computed(() => windowEnd.value   ? dayjs(windowEnd.value).format('DD MMM YYYY')   : '')

const holidays = ref<Holiday[]>([])
const holidaysSet = computed(() => new Set(holidays.value.map(h => h.date)))
const teamVacations = ref<TeamVacation[]>([])
const unavailable = ref<string[]>([])

const selectedStart = ref<string | null>(null)
const selectedEnd = ref<string | null>(null)
const hoverDate = ref<string | null>(null)
const requestOpen = ref(false)

const toastMsg = ref<string | null>(null)
function notify(msg: string) {
  toastMsg.value = msg
  setTimeout(() => (toastMsg.value = null), 3500)
}

const teamCountByDate = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const tv of teamVacations.value) {
    let d = dayjs(tv.startDate)
    const end = dayjs(tv.endDate)
    while (d.isSame(end, 'day') || d.isBefore(end, 'day')) {
      const key = d.format('YYYY-MM-DD')
      map[key] = (map[key] ?? 0) + 1
      d = d.add(1, 'day')
    }
  }
  return map
})

function isWeekendYMD(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00Z`)
  const dow = d.getUTCDay()
  return dow === 0 || dow === 6
}

const isHoliday = (dateStr: string) => holidaysSet.value.has(dateStr)
const isFull = (dateStr: string) => (teamCountByDate.value[dateStr] ?? 0) >= MAX_PER_DAY
const isUnavailable = (dateStr: string) => unavailable.value.includes(dateStr)
const pluralizeDays = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
const formatDate = (iso: string) => dayjs(iso).format('DD/MM/YYYY')

const today = computed(() => dayjs().startOf('day'))
const isPast = (iso: string) => dayjs(iso).endOf('day').isBefore(today.value)

function countBusinessDays(startISO: string, endISO: string): number {
  let d = dayjs(startISO)
  const end = dayjs(endISO)
  let count = 0
  while (d.isSame(end, 'day') || d.isBefore(end, 'day')) {
    const key = d.format('YYYY-MM-DD')
    if (!isWeekendYMD(key) && !isHoliday(key)) count++
    d = d.add(1, 'day')
  }
  return count
}

function abbrevName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return full
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last && last !== first ? `${first} ${last[0]}.` : first
}

function canPickDay(d: dayjs.Dayjs): boolean {
  const key = d.format('YYYY-MM-DD')
  if (!d.isAfter(today.value, 'day')) return false
  const weekend = isWeekendYMD(key)
  const holiday = isHoliday(key)
  if (weekend || holiday) return true
  if (isFull(key)) return false
  if (isUnavailable(key)) return false
  return true
}

function getSingleDayBlockReason(d: dayjs.Dayjs): string {
  const key = d.format('YYYY-MM-DD')
  if (!d.isAfter(today.value, 'day')) return 'No puedes seleccionar fechas pasadas ni el día de hoy.'
  const weekend = isWeekendYMD(key)
  const holiday = isHoliday(key)
  if (weekend || holiday) return ''
  if (isFull(key)) return `No disponible: cupo lleno el ${formatDate(key)} (máximo ${MAX_PER_DAY} personas).`
  if (isUnavailable(key)) return `Día no disponible: ${formatDate(key)}.`
  return 'No se puede seleccionar este día.'
}

function validateRangeSelection(startISO: string, endISO: string): { ok: boolean; reason?: string } {
  let d = dayjs(startISO)
  const end = dayjs(endISO)
  while (d.isSame(end, 'day') || d.isBefore(end, 'day')) {
    const key = d.format('YYYY-MM-DD')
    const weekend = isWeekendYMD(key)
    const holiday = isHoliday(key)
    if (!d.isAfter(today.value, 'day')) return { ok: false, reason: `No puedes seleccionar fechas pasadas (incluye ${formatDate(key)}).` }
    if (!(weekend || holiday)) {
      if (isFull(key)) return { ok: false, reason: `Cupo lleno el ${formatDate(key)} (máximo ${MAX_PER_DAY} personas).` }
      if (isUnavailable(key)) return { ok: false, reason: `Día no disponible: ${formatDate(key)}.` }
    }
    d = d.add(1, 'day')
  }
  return { ok: true }
}

function normalizeRange(aISO: string, bISO: string): { start: string; end: string } {
  const a = dayjs(aISO), b = dayjs(bISO)
  if (b.isBefore(a, 'day')) return { start: b.format('YYYY-MM-DD'), end: a.format('YYYY-MM-DD') }
  return { start: a.format('YYYY-MM-DD'), end: b.format('YYYY-MM-DD') }
}

const canCancel = (startISO: string) => {
  const t = dayjs().startOf('day')
  const s = dayjs(startISO).startOf('day')
  return s.isAfter(t, 'day')
}

const previewEnd = ref<string | null>(null)

const selectedBusinessDays = computed(() => {
  const start = selectedStart.value
  const end = selectedEnd.value ?? previewEnd.value
  return start && end ? countBusinessDays(start, end) : 0
})

type CalendarDay = {
  date: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  isHoliday: boolean
  isFull: boolean
  isAvailable: boolean
  inSelection: boolean
  holidayName?: string
  hasTeamApproved: boolean
  approvedNamesShort: string
  approvedNamesFull: string
  teamCount: number
  topTwoNames: string[]
  extraCount: number
}

const calendarDays = computed<CalendarDay[]>(() => {
  const startOfMonth = currentDate.value.startOf('month')
  const endOfMonth = currentDate.value.endOf('month')

  const startGrid = startOfMonth.subtract(startOfMonth.day(), 'day')
  const endGrid   = endOfMonth.add(6 - endOfMonth.day(), 'day')

  const out: CalendarDay[] = []
  let d = startGrid
  while (d.isSame(endGrid, 'day') || d.isBefore(endGrid, 'day')) {
    const dateStr = d.format('YYYY-MM-DD')
    const weekend = isWeekendYMD(dateStr)
    const holiday = isHoliday(dateStr)
    const full = isFull(dateStr)
    const available = canPickDay(d)

    const holidayName = holidays.value.find(h => h.date === dateStr)?.name || ''

    const dd = dayjs(dateStr)
    const teamApprovedNames = teamVacations.value
      .filter(tv => {
        const s = dayjs(tv.startDate), e = dayjs(tv.endDate)
        return (dd.isSame(s, 'day') || dd.isAfter(s, 'day')) &&
               (dd.isSame(e, 'day') || dd.isBefore(e, 'day'))
      })
      .map(tv => tv.user?.name)
      .filter((n): n is string => !!n)

    const uniqueNames = Array.from(new Set(teamApprovedNames))
    const teamCount = uniqueNames.length
    const hasTeamApproved = teamCount > 0
    const approvedNamesFull = uniqueNames.join(', ')
    const approvedNamesShort =
      uniqueNames.length <= 2
        ? approvedNamesFull
        : `${uniqueNames[0]}, ${uniqueNames[1]} +${uniqueNames.length - 2}`

    const topTwoNames = uniqueNames.slice(0, 2).map(abbrevName)
    const extraCount = Math.max(uniqueNames.length - 2, 0)

    let inSelection = false
    const endRef = previewEnd.value ?? selectedEnd.value
    if (selectedStart.value && endRef) {
      const { start, end } = normalizeRange(selectedStart.value, endRef)
      const dd2 = dayjs(dateStr)
      inSelection =
        (dd2.isSame(start, 'day') || dd2.isAfter(start, 'day')) &&
        (dd2.isSame(end, 'day')   || dd2.isBefore(end, 'day'))
    }

    out.push({
      date: dateStr,
      day: d.date(),
      isCurrentMonth: d.isSame(currentDate.value, 'month'),
      isToday: d.isSame(dayjs(), 'day'),
      isWeekend: weekend,
      isHoliday: holiday,
      isFull: full,
      isAvailable: available,
      inSelection,
      holidayName,
      hasTeamApproved,
      approvedNamesShort,
      approvedNamesFull,
      teamCount,
      topTwoNames,
      extraCount
    })
    d = d.add(1, 'day')
  }
  return out
})

function getDayTooltip(day: CalendarDay): string {
  const parts: string[] = [formatDate(day.date)]
  if (day.teamCount > 0) {
    parts.push(`• ${day.teamCount}/${MAX_PER_DAY} en vacaciones${day.isFull ? ' (cupo lleno)' : ''}`)
    if (day.hasTeamApproved) parts.push(`• Aprobado: ${day.approvedNamesFull}`)
  }
  if (day.isHoliday) parts.push(`• Día festivo${day.holidayName ? `: ${day.holidayName}` : ''}`)
  if (day.isWeekend) parts.push('• Fin de semana')

  if (!day.isAvailable) {
    const djs = dayjs(day.date)
    if (!djs.isAfter(today.value, 'day')) parts.push('• No disponible (hoy o pasado)')
    if (day.isFull) parts.push('• Cupo lleno')
    if (isUnavailable(day.date)) parts.push('• No disponible')
  } else {
    parts.push('• Clicable')
  }
  if (day.inSelection) parts.push('• Selección')
  return parts.join(' | ')
}

function onClickDay(day: CalendarDay) {
  const d = dayjs(day.date)
  if (!selectedStart.value || selectedEnd.value) {
    if (!canPickDay(d)) { notify(getSingleDayBlockReason(d)); return }
    selectedStart.value = day.date
    selectedEnd.value = null
    previewEnd.value = day.date
    return
  }

  const { start, end } = normalizeRange(selectedStart.value, day.date)
  const check = validateRangeSelection(start, end)
  if (!check.ok) { notify(check.reason || 'No se puede seleccionar ese rango.'); return }

  const business = countBusinessDays(start, end)
  if (business > availableDays.value) {
    notify(`No tienes suficientes días disponibles. Selección requerida: ${business}, disponibles: ${availableDays.value}.`)
    return
  }

  selectedStart.value = start
  selectedEnd.value = end
  previewEnd.value = end
  requestOpen.value = true
}

function onHoverDay(day: CalendarDay) {
  if (selectedStart.value && !selectedEnd.value) {
    previewEnd.value = day.date
  }
}

function resetSelection() {
  selectedStart.value = null
  selectedEnd.value = null
  hoverDate.value = null
}

function goPrevMonth() { currentDate.value = currentDate.value.subtract(1, 'month'); loadCalendarData() }
function goNextMonth() { currentDate.value = currentDate.value.add(1, 'month'); loadCalendarData() }

const pendingRequests = ref<VacationRequest[]>([])
const approvedRequests = ref<VacationRequest[]>([])
const rejectedRequests = ref<VacationRequest[]>([])

const latestRejected = computed<VacationRequest[]>(() => {
  if (!rejectedRequests.value.length) return []
  const sorted = [...rejectedRequests.value].sort((a, b) => {
    const aKey = dayjs(a.createdAt ?? a.startDate).valueOf()
    const bKey = dayjs(b.createdAt ?? b.startDate).valueOf()
    return bKey - aKey
  })
  return [sorted[0]]
})

async function loadBalance() {
  try {
    const b: VacationBalance = await getVacationBalance()
    availableDays.value = b.availableDays
    usedDays.value = b.usedDays
    totalAnnualDays.value = b.totalAnnualDays
  } catch {
    availableDays.value = 0
    usedDays.value = 0
    totalAnnualDays.value = 0
  }
}

async function loadCalendarData() {
  const start = currentDate.value.startOf('month').format('YYYY-MM-DD')
  const end = currentDate.value.endOf('month').format('YYYY-MM-DD')
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const [h, tv, un] = await Promise.all([
    getHolidays(start, end, tz),
    getTeamVacations(start, end),
    getUnavailableDates(start, end)
  ])

  holidays.value = h
  teamVacations.value = tv

  const holidaySet = new Set(h.map(x => x.date))
  unavailable.value = (un || []).filter(d => !holidaySet.has(d))
}

async function loadUserRequests() {
  const data = await getUserVacations()

  type WithStatus = { status?: VacationRequest['status'] }
  const byStatus = (s: VacationRequest['status']) => (r: WithStatus): r is Required<WithStatus> => r.status === s

  const pending  = (data.pending  ?? []).filter(byStatus('pending'))
  const approved = (data.approved ?? []).filter(byStatus('approved'))
  const rejected = (data.rejected ?? []).filter(byStatus('rejected'))

  pendingRequests.value  = pending  as unknown as VacationRequest[]
  approvedRequests.value = approved as unknown as VacationRequest[]
  rejectedRequests.value = rejected as unknown as VacationRequest[]
}

// Cargar resumen (ventana vigente)
async function loadSummary() {
  try {
    const s = await getMyEntitlement()
    windowStart.value = s.cycle.window.start?.slice(0,10) || ''
    windowEnd.value   = s.cycle.window.end?.slice(0,10)   || ''
  } catch {
    windowStart.value = ''
    windowEnd.value   = ''
  }
}

async function submitVacationRequest(reason: string) {
  if (!selectedStart.value || !selectedEnd.value) return
  try {
    await requestVacation({ startDate: selectedStart.value, endDate: selectedEnd.value, reason })
    requestOpen.value = false
    resetSelection()
    await Promise.all([loadUserRequests(), loadBalance(), loadCalendarData(), loadSummary()])
  } catch {}
}
function handleDialogCancel() {
  requestOpen.value = false
  resetSelection()
}
async function cancel(id: string) {
  try {
    await cancelVacationRequest(id)
    await Promise.all([loadUserRequests(), loadBalance(), loadCalendarData(), loadSummary()])
  } catch {}
}

const daysLeft = computed(() => {
  if (!windowEnd.value) return 0
  const today = new Date(); today.setUTCHours(0,0,0,0)
  const end   = new Date(`${windowEnd.value}T00:00:00Z`)
  const ms    = Math.max(0, end.getTime() - today.getTime())
  return Math.ceil(ms / 86400000)
})

const periodPct = computed(() => {
  if (!windowStart.value || !windowEnd.value) return 0
  const start = new Date(`${windowStart.value}T00:00:00Z`)
  const end   = new Date(`${windowEnd.value}T00:00:00Z`)
  const today = new Date(); today.setUTCHours(0,0,0,0)

  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  const leftDays  = Math.max(0, Math.ceil((end.getTime() - today.getTime())  / 86400000))
  const pct = (leftDays / totalDays) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
})

onMounted(async () => {
  await Promise.all([loadBalance(), loadCalendarData(), loadUserRequests(), loadSummary()])
})
</script>

<style scoped>
:root{
  --bg:#f6f8fb; --card:#fff; --text:#0f172a; --muted:#64748b; --line:#e2e8f0;
  --brand:#2563eb; --ring:rgba(37,99,235,.25);
  --ok:#22c55e; --warn:#f59e0b; --danger:#ef4444; --info:#3b82f6;
}

/* Oculta posibles widgets/debug flotantes */
.tweak-fab,.debug-fab,.ui-tweak-toggle,.fab-settings,.fab-debug,.debug-box,.meta-debug{ display:none!important; }

/* Toast */
.toast{ position:fixed; right:16px; bottom:16px; background:#111827; color:#fff; padding:.6rem .9rem; border-radius:10px; box-shadow:0 8px 20px rgba(0,0,0,.25); z-index:99; max-width:80vw; }

.vacations-page{ display:flex; flex-direction:column; gap:1rem; color:var(--text); background:var(--bg); }

/* KPIs */
.kpi-grid{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:1rem; }
@media (max-width:1100px){ .kpi-grid{ grid-template-columns:repeat(2,1fr) } }
@media (max-width:640px){ .kpi-grid{ grid-template-columns:1fr } }

.kpi-card{ background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06); padding:1rem 1.25rem; }
.kpi-value{ font-size:2rem; font-weight:700; }
.kpi-label{ margin-top:.25rem; color:var(--muted); }

/* “Disponibles” barra en verde */
.kpi-card:first-child .kpi-bar{ margin-top:.6rem; height:8px; width:100%; background:#f1f5f9; border-radius:999px; overflow:hidden; border:1px solid #eef2f7; }
.kpi-card:first-child .kpi-bar-fill{ height:100%; background:linear-gradient(90deg,#16a34a,#22c55e,#86efac); transition:width .35s; }

.kpi-card:nth-child(2) small{ display:inline-block; margin-top:.4rem; font-weight:700; padding:.2rem .55rem; border-radius:999px; color:#fff; background:linear-gradient(90deg,#3b82f6,#6366f1); box-shadow:0 6px 16px rgba(99,102,241,.18); }
.kpi-card:nth-child(3) small{ display:inline-block; margin-top:.4rem; color:#065f46; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:999px; padding:.18rem .55rem; }

/* Periodo vigente (azules) */
.kpi-card.kpi-period .period-dates{ font-size:1.25rem; font-weight:700; display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; }
.kpi-card.kpi-period .date{ white-space:nowrap; }
.kpi-card.kpi-period .arrow{ opacity:.6; }
.kpi-card.kpi-period .badge-soft{
  display:inline-block; margin-top:.4rem;
  padding:.18rem .55rem; border-radius:999px; font-size:.8rem;
  background:#eef2ff; color:#1e40af; border:1px solid #c7d2fe;
}
.kpi-card.kpi-period .period-bar{ margin-top:.6rem; height:8px; width:100%; background:#f1f5f9; border-radius:999px; overflow:hidden; border:1px solid #eef2f7; }
.kpi-card.kpi-period .period-fill{ height:100%; background:linear-gradient(90deg,#0ea5e9,#60a5fa,#93c5fd); transition:width .35s; }

/* Layout principal */
.content-grid{ display:grid; grid-template-columns:1fr 320px; gap:1rem; }
@media (max-width:1100px){ .content-grid{ grid-template-columns:1fr } }

/* Calendario y resto (sin cambios de color) */
.calendar-card{ background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06); padding:1rem 1.25rem; }
.calendar-header{ display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
.month-title{ flex:1; text-align:center; text-transform:capitalize; font-weight:700; }
.nav-btn{ width:40px; height:40px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; background:#f8fafc; border:1.5px solid var(--line); cursor:pointer; }
.nav-btn:hover{ outline:2px solid var(--ring); }

.legend{ display:flex; gap:1rem; align-items:center; flex-wrap:wrap; color:var(--muted); font-size:.92rem; padding:.25rem 0 .75rem 0; }
.legend .dot{ width:10px; height:10px; border-radius:999px; display:inline-block; margin-right:.35rem; }
.dot--green{ background:var(--ok) } .dot--yellow{ background:var(--warn) } .dot--red{ background:var(--danger) } .dot--blue{ background:var(--info) }

.weekday-row{ display:grid; grid-template-columns:repeat(7,1fr); gap:.5rem; padding:0 .1rem; }
.weekday-cell{ text-align:center; color:var(--muted); font-size:.9rem; }

.calendar-grid{ --cell:82px; display:grid; grid-template-columns:repeat(7,1fr); gap:.5rem; margin-top:.35rem; }

.day-cell{
  position:relative; min-height:var(--cell);
  background:#fff; border:1.5px solid var(--line); border-radius:12px;
  padding:.55rem .6rem; display:flex; flex-direction:column; justify-content:flex-end;
  cursor:pointer; transition:box-shadow .15s ease, transform .05s ease;
  box-shadow:0 1px 0 rgba(15,23,42,.04);
}
.day-cell:hover{ outline:2px solid var(--ring) }
.day-cell.is-other-month{ opacity:.45 }
.day-cell.is-today{ box-shadow:inset 0 0 0 2px var(--brand) }

.badges{ position:absolute; top:6px; left:6px; right:6px; display:flex; gap:6px; flex-wrap:wrap; align-items:center; pointer-events:none; }
.badge{ font-size:.68rem; line-height:1; padding:.12rem .38rem; border-radius:8px; border:1px solid; background:#f8fafc; color:#334155; border-color:var(--line); box-shadow:0 1px 0 rgba(0,0,0,.02); }
.badge--holiday{ background:#eef6ff; color:#1d4ed8; border-color:#bfdbfe }
.badge--weekend{ background:#f3f4f6; color:#475569; border-color: var(--line); }
.badge--count{ margin-left:auto; background:#e7f9ef; color:#166534; border-color:#86efac; font-weight:700 }
.badge--count.is-full{ background:#fff1f2; color:#991b1b; border-color:#fecaca }

.day-cell.is-selected{
  background:linear-gradient(180deg,#eff6ff 0%,#fff 80%);
  border-color:#bfdbfe;
  box-shadow:inset 0 0 0 1.5px #93c5fd, 0 0 0 3px rgba(37,99,235,.10);
}
.day-cell.is-selected .day-number{ color:#1e3a8a }

.day-cell.is-full{ background:#fff7ed; border-color:#fed7aa }
.day-cell.is-holiday:not(.is-full){ background:#eff6ff; border-color:#bfdbfe }
.day-cell.is-weekend:not(.is-full):not(.is-holiday){ background:#fafafa }

.day-number{ font-weight:600 }
.dot{ position:absolute; right:8px; bottom:8px; width:9px; height:9px; border-radius:999px }

.labels{ position:absolute; top:28px; right:6px; display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; max-width:calc(100% - 12px); }
.chip{ font-size:.68rem; line-height:1; padding:.05rem .35rem; border-radius:8px; border:1px solid; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.chip--approved{ background:#e7f9ef; color:#166534; border-color:#86efac }
.chip.more{ font-weight:700 }

.side-panels{ display:flex; flex-direction:column; gap:1rem }
.panel{ background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:0 8px 24px rgba(15,23,42,.06); padding:1rem 1.25rem }
.panel h3{ margin:.25rem 0 .75rem; font-size:1rem }
.instructions{ margin:0 0 0 1.1rem; color:var(--muted) }
.muted{ color:var(--muted) }
.requests{ display:flex; flex-direction:column; gap:.75rem }
.request-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:.65rem .75rem; border:1px dashed var(--line); border-radius:12px; background:#fff }
.side-panels .panel:nth-of-type(2) .request-row{ border-left:4px solid var(--warn); background:#fff7ed }
.side-panels .panel:nth-of-type(3) .request-row{ border-left:4px solid var(--ok); background:#ecfdf5 }
.request-row.expired{ background:#f3f4f6; border-color:#e5e7eb; color:#6b7280; }
.request-row.expired .badge-success{ background:#e5e7eb; color:#6b7280; }
.request-row.expired .btn{ display:none; }

.actions{ display:flex; align-items:center; gap:.5rem }
.btn{ padding:.45rem .7rem; border-radius:10px; border:1.5px solid var(--line); background:#f8fafc; color: var(--text); cursor:pointer; }
.btn:hover{ background:#eef2ff }
.btn-danger{ background:#fee2e2; color:#991b1b; border-color:#fecaca }
.btn-danger:hover{ background:#fecaca }
.ml-2{ margin-left:.5rem }
.badge-success{ display:inline-flex; align-items:center; gap:.35rem; border-radius:999px; padding:.15rem .6rem; font-size:.8rem; background:#ecfdf5; color:#065f46 }
.vacations-page ::selection{ background:rgba(37,99,235,.15) }
</style>
