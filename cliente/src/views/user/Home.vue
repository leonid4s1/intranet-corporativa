<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, computed, onMounted, defineOptions } from 'vue'
import '@/assets/styles/components/home.css'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'

// Carrusel
import NewsCarousel from '@/components/ui/NewsCarousel.vue'
import { getHomeNews, type NewsItem } from '@/services/news.service'

defineOptions({ name: 'HomePage' })

interface Task {
  _id: string
  title: string
  status: 'completed' | 'in-progress' | 'pending'
}
interface User {
  name: string
  role?: string
  department?: string
  avatar?: string
}

const router = useRouter()

const user = ref<User>({ name: 'Usuario' })
const tasks = ref<Task[]>([])
const loading = ref(true)
const error = ref('')

// Noticias
const newsItems = ref<NewsItem[]>([])
const carouselItems = computed<NewsItem[]>(() => {
  if (newsItems.value.length) return newsItems.value
  // Placeholder cuando no hay noticias
  return [{
    id: 'no-news',
    type: 'static',
    title: 'Sin noticias o comunicados',
    excerpt: 'No hay Noticias o Comunicados por ahora.',
    imageUrl: null,
    ctaText: null,
    ctaTo: null
  }]
})

const timeOfDay = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'dias'
  if (hour < 19) return 'tardes'
  return 'noches'
})

const pendingTasksCount = computed(() =>
  tasks.value.filter((t) => t.status === 'pending').length
)

onMounted(async () => {
  try {
    const response = await api.get('/auth/profile')
    if (response?.data?.user?.name) user.value = response.data.user
  } catch {
    error.value = 'No se pudo cargar la información del usuario'
  } finally {
    loading.value = false
  }

  try {
    newsItems.value = await getHomeNews()
  } catch {
    newsItems.value = []
  }
})

const auth = useAuthStore()
const loggingOut = ref(false)
const handleLogout = async () => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await auth.logout() // redirige a /login
  } finally {
    loggingOut.value = false
  }
}

const navigateTo = (path: string) => router.push(`/${path}`)
</script>

<template>
  <div class="home">
    <!-- Header -->
    <header class="user-header">
      <div class="user-header__top">
        <template v-if="!loading">
          <h2 class="user-header__greeting">Buenas {{ timeOfDay }}, {{ user.name }}</h2>
          <div class="user-header__info">
            <span class="user-header__company">CIM</span>
            <button @click="handleLogout" class="logout-btn" :disabled="loggingOut">
              {{ loggingOut ? 'Saliendo…' : 'Cerrar sesión' }}
            </button>
          </div>
        </template>
        <div v-else>Cargando información del usuario...</div>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </header>

    <!-- Acceso rápido -->
    <section class="quick-access">

      <div class="access-grid">
        <!-- Deshabilitados -->
        <div class="access-card is-disabled" aria-disabled="true" tabindex="-1">
          <i class="fas fa-file-alt"></i>
          <h4>Documentación</h4>
          <p>Acceso a manuales y reglamentos</p>
        </div>

        <div class="access-card is-disabled" aria-disabled="true" tabindex="-1">
          <h4>Formatos</h4>
          <p>Planillas y formatos corporativos</p>
        </div>

        <!-- ÚNICO ACTIVO -->
        <div class="access-card vacation-card" @click="navigateTo('vacaciones')">
          <i class="fas fa-calendar-check"></i>
          <h4>Vacaciones</h4>
          <p>Administra tus dias libres</p>
        </div>

        <div class="access-card is-disabled" aria-disabled="true" tabindex="-1">
          <i class="fas fa-tasks"></i>
          <h4>Tareas</h4>
          <p>
            Visualiza tus pendientes
            <span v-if="pendingTasksCount > 0" class="badge">{{ pendingTasksCount }}</span>
          </p>
        </div>
      </div>
    </section>

    <!-- Noticias (con placeholder si no hay items) -->
    <section class="news-section">
      <h3>Noticias y Comunicados</h3>
      <NewsCarousel :items="carouselItems" />
    </section>

    <!-- Resumen de tareas (OCULTO) -->
    <!-- <section class="tasks-summary"> ... </section> -->
  </div>
</template>
