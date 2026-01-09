<!-- cliente/src/views/user/RolesFuncionesView.vue -->
<template>
  <section class="page">
    <header class="page__head">
      <h1 class="page__title">Roles y funciones</h1>
      <p class="page__subtitle">
        Información de tu puesto, responsabilidades y métricas clave.
      </p>
    </header>

    <div v-if="loading" class="state">
      <LoadingSpinner />
      <p class="state__text">Cargando tu perfil de rol…</p>
    </div>

    <div v-else-if="error" class="state state--error">
      <p class="state__text">{{ error }}</p>
      <button class="btn" @click="load">Reintentar</button>
    </div>

    <div v-else-if="role" class="grid">
      <!-- Bloque 1: Rol y descripción -->
      <article class="card">
        <div class="card__head">
          <div class="chip">{{ role.department }}</div>
          <h2 class="card__title">{{ role.title }}</h2>
          <p class="card__meta">
            <span class="muted">Reporta a:</span>
            <strong>{{ role.reportsTo }}</strong>
          </p>
        </div>

        <div class="card__body">
          <h3 class="card__section-title">Descripción del puesto</h3>
          <p class="card__text">
            {{ role.description }}
          </p>

          <h3 class="card__section-title">Funciones principales</h3>

          <ul v-if="role.responsibilities?.length" class="list">
            <li v-for="(r, i) in role.responsibilities" :key="i">
              {{ r }}
            </li>
          </ul>

          <p v-else class="muted">
            No hay funciones registradas para este rol.
          </p>
        </div>
      </article>

      <!-- Bloque 2: Métricas/KPIs -->
      <article class="card">
        <div class="card__head">
          <h2 class="card__title">Métricas clave</h2>
          <p class="card__meta muted">
            Comparación de valor actual vs objetivo.
          </p>
        </div>

        <div class="card__body">
          <div v-if="role.kpis?.length" class="kpis">
            <div v-for="(k, i) in role.kpis" :key="i" class="kpi">
              <div class="kpi__top">
                <div class="kpi__label">{{ k.label }}</div>
                <div class="kpi__nums">
                  <span class="kpi__value">{{ clampPct(k.value) }}%</span>
                  <span class="kpi__sep">/</span>
                  <span class="kpi__target">{{ clampPct(k.target) }}%</span>
                </div>
              </div>

              <div class="bar" role="progressbar"
                   :aria-valuenow="clampPct(k.value)"
                   aria-valuemin="0"
                   aria-valuemax="100"
              >
                <div class="bar__fill" :style="{ width: clampPct(k.value) + '%' }"></div>
                <div class="bar__target" :style="{ left: clampPct(k.target) + '%' }" :title="`Objetivo: ${clampPct(k.target)}%`"></div>
              </div>

              <p class="kpi__hint">
                Objetivo: <strong>{{ clampPct(k.target) }}%</strong>
              </p>
            </div>
          </div>

          <p v-else class="muted">
            No hay KPIs registrados para este rol.
          </p>
        </div>
      </article>
    </div>

    <div v-else class="state state--error">
      <p class="state__text">No se encontró información del rol.</p>
      <button class="btn" @click="load">Reintentar</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { getMyRoleProfile, type RoleProfile } from '@/services/rolesProfile.service'

const loading = ref(true)
const error = ref<string | null>(null)
const role = ref<RoleProfile | null>(null)

function clampPct(n: unknown) {
  const v = Number(n ?? 0)
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

async function load() {
  loading.value = true
  error.value = null
  role.value = null

  try {
    role.value = await getMyRoleProfile()
  } catch (e: unknown) {
    let msg = 'No se pudo cargar tu perfil de rol.'

    if (typeof e === 'object' && e !== null) {
      const err = e as {
        response?: {
          status?: number
          data?: {
            message?: string
            error?: string
          }
        }
      }

      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        ''

      // ✅ Caso esperado: aún no asignado
      if (err.response?.status === 404 && serverMsg.includes('no tiene un rol asignado')) {
        msg = 'Aún no tienes un rol asignado. Solicita al administrador que te lo asigne.'
      }
      // (opcional) existe roleKey pero no hay RoleProfile
      else if (err.response?.status === 404 && serverMsg.includes('No existe perfil de rol')) {
        msg = 'Tu rol está asignado, pero aún no hay información cargada para mostrar.'
      }
      // otros errores
      else if (serverMsg) {
        msg = serverMsg
      }
    }

    error.value = msg
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page {
  padding: 1.25rem 1.25rem 2rem;
}

.page__head {
  margin-bottom: 1rem;
}

.page__title {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 0;
}

.page__subtitle {
  margin: 0.35rem 0 0;
  color: rgba(0,0,0,.65);
  font-size: .95rem;
}

.grid {
  display: grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 1rem;
}

@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr; }
}

.card {
  background: #fff;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,.04);
  overflow: hidden;
}

.card__head {
  padding: 1rem 1rem .75rem;
  border-bottom: 1px solid rgba(0,0,0,.06);
}

.card__title {
  margin: .35rem 0 0;
  font-size: 1.15rem;
  font-weight: 800;
}

.card__meta {
  margin: .35rem 0 0;
  font-size: .92rem;
}

.card__body {
  padding: 1rem;
}

.card__section-title {
  margin: 0 0 .5rem;
  font-size: .95rem;
  font-weight: 800;
}

.card__text {
  margin: 0 0 1rem;
  color: rgba(0,0,0,.75);
  line-height: 1.55;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .2rem .55rem;
  font-size: .75rem;
  font-weight: 800;
  border-radius: 999px;
  background: rgba(75,80,85,.10);
  color: rgba(0,0,0,.75);
}

.list {
  margin: .25rem 0 0;
  padding-left: 1.15rem;
  display: grid;
  gap: .4rem;
}

.muted {
  color: rgba(0,0,0,.6);
}

.state {
  display: grid;
  place-items: center;
  gap: .6rem;
  padding: 2rem 1rem;
  background: rgba(0,0,0,.03);
  border: 1px dashed rgba(0,0,0,.15);
  border-radius: 16px;
}

.state--error {
  background: rgba(231, 76, 60, .06);
  border-color: rgba(231, 76, 60, .20);
}

.state__text {
  margin: 0;
  color: rgba(0,0,0,.75);
  text-align: center;
}

.btn {
  border: 1px solid rgba(0,0,0,.18);
  background: #fff;
  border-radius: 12px;
  padding: .55rem .85rem;
  font-weight: 800;
  cursor: pointer;
}
.btn:hover { background: rgba(0,0,0,.04); }

/* KPIs */
.kpis {
  display: grid;
  gap: .9rem;
}

.kpi__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: .75rem;
}

.kpi__label {
  font-weight: 800;
  font-size: .95rem;
  color: rgba(0,0,0,.78);
}

.kpi__nums {
  font-weight: 800;
  font-size: .9rem;
  color: rgba(0,0,0,.75);
  white-space: nowrap;
}
.kpi__sep { margin: 0 .25rem; opacity: .6; }
.kpi__target { opacity: .75; }

.bar {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: rgba(0,0,0,.08);
  overflow: hidden;
  margin-top: .45rem;
}

.bar__fill {
  height: 100%;
  background: rgba(75,80,85,.75);
  border-radius: 999px;
}

.bar__target {
  position: absolute;
  top: -4px;
  width: 2px;
  height: 18px;
  background: rgba(231, 76, 60, .75);
  transform: translateX(-1px);
  border-radius: 2px;
}

.kpi__hint {
  margin: .35rem 0 0;
  font-size: .85rem;
  color: rgba(0,0,0,.62);
}
</style>
