<template>
  <div class="auth-container">
    <h1>Iniciar Sesión</h1>

    <form @submit.prevent="handleSubmit" class="auth-form">
      <div class="form-group">
        <label for="email">Correo electrónico:</label>
        <input
          type="email"
          id="email"
          v-model="email"
          required
          autocomplete="username"
          placeholder="tu@email.com"
        />
      </div>

      <div class="form-group">
        <label for="password">Contraseña:</label>

        <!-- Wrapper con botón "ojito" -->
        <div class="password-wrapper">
          <input
            :type="showPassword ? 'text' : 'password'"
            id="password"
            v-model="password"
            required
            autocomplete="current-password"
            placeholder="Tu contraseña"
            class="password-input"
          />

          <button
            type="button"
            class="toggle-btn"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            :title="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            @click="showPassword = !showPassword"
          >
            <!-- Ojo abierto -->
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">
              <path d="M12 5c-5.5 0-9.5 4.5-10.7 6 .9 1.2 4.7 6 10.7 6s9.8-4.8 10.7-6C21.5 9.5 17.5 5 12 5Zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2.5A1.5 1.5 0 1 0 12 9a1.5 1.5 0 0 0 0 3.5Z"/>
            </svg>
            <!-- Ojo tachado -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">
              <path d="M3.3 2.3 2 3.6l3 3C3.6 7.8 2.5 9.2 1.3 11c.9 1.2 4.7 6 10.7 6 2.1 0 3.9-.5 5.5-1.3l3.5 3.5 1.3-1.3L3.3 2.3ZM12 15c-1.7 0-3.1-1.1-3.7-2.6l1.1 1.1A2 2 0 0 0 14 12c0-.2 0-.4-.1-.6l1.7 1.7A4 4 0 0 1 12 15Zm0-10c5.5 0 9.5 4.5 10.7 6-.5.7-1.6 2.2-3.3 3.6l-1.4-1.4c1.2-1 2.1-2.2 2.7-3-1-1.2-4.8-5-8.7-5-1.7 0-3.2.4-4.5 1l-1.1-1.1C8.1 4.4 9.9 4 12 4Z"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <button type="submit" :disabled="isLoading" class="auth-button">
        {{ isLoading ? 'Cargando...' : 'Ingresar' }}
      </button>
    </form>

    <div class="auth-footer">
      <p class="hint">
        ¿Problemas para entrar? Contacta al administrador.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const isLoading = ref(false);
const email = ref('');
const password = ref('');
const error = ref('');

// NUEVO: estado para mostrar/ocultar contraseña
const showPassword = ref(false);

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// --- Tipos auxiliares para errores ---
type ApiErrorData = { message?: string };
type AxiosLikeError = {
  message?: string;
  response?: { data?: ApiErrorData };
};

// --- Utils ---
function safeDecodeRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const dec = decodeURIComponent(raw);
    if (dec.startsWith('/') && !dec.startsWith('//') && dec !== '/login') {
      return dec;
    }
    return null;
  } catch {
    return null;
  }
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as AxiosLikeError;
    const apiMsg = e.response?.data?.message;
    if (typeof apiMsg === 'string' && apiMsg.trim().length > 0) return apiMsg;
    if (typeof e.message === 'string' && e.message.trim().length > 0) return e.message;
  }
  return 'Error al iniciar sesión. Intente nuevamente';
}

// --- Submit ---
const handleSubmit = async () => {
  isLoading.value = true;
  error.value = '';

  try {
    await authStore.login({
      email: email.value.trim(),
      password: password.value.trim(),
    });

    const redirectPath = safeDecodeRedirect(route.query.redirect);
    if (redirectPath) {
      return router.replace(redirectPath);
    }

    return router.replace({ name: authStore.isAdmin ? 'admin-dashboard' : 'home' });
  } catch (err: unknown) {
    error.value = extractErrorMessage(err);
    console.error('Error detallado en login:', err);
  } finally {
    isLoading.value = false;
  }
};

// Usuario ya autenticado no debe quedarse en /login
if (authStore.isAuthenticated) {
  router.replace({ name: authStore.isAdmin ? 'admin-dashboard' : 'home' });
}
</script>

<style scoped>
/* === Tokens de marca (toma los globales si existen) === */
:root{
  --brand: var(--brand-ink, #4b5055);
  --brand-ring: color-mix(in oklab, var(--brand) 25%, transparent);
  --brand-600: color-mix(in oklab, var(--brand) 88%, black);
  --brand-500: var(--brand);
  --brand-400: color-mix(in oklab, var(--brand) 85%, white);

  --ink: var(--brand-ink, #4b5055);
  --muted: #6b7280;
  --line: var(--brand-gray-300, #e5e7eb);
  --bg: #ffffff;
}

/* === Card/Login === */
.auth-container {
  max-width: 480px;
  margin: 3rem auto;
  padding: 2rem;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--line);
  box-shadow: 0 10px 30px rgba(15,23,42,.08);
}

h1 {
  text-align: center;
  color: var(--ink);
  margin-bottom: 1.25rem;
  font-weight: 800;
}

/* Subrayado fino de marca debajo del título */
h1::after{
  content:"";
  display:block;
  width:64px; height:3px;
  margin:.5rem auto 0;
  border-radius:999px;
  background: var(--brand-500);
  opacity:.6;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: .45rem;
}

label { font-weight: 600; color: var(--ink); }

input {
  padding: .8rem .9rem;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  font-size: 1rem;
  color: var(--ink);
  background: #fff;
  transition: border-color .15s, box-shadow .15s;
}

input:hover { border-color: color-mix(in oklab, var(--line) 60%, var(--brand-400)); }

input:focus {
  outline: 0;
  border-color: var(--brand-400);
  box-shadow: 0 0 0 3px var(--brand-ring);
}

/* --- Password + ojito --- */
.password-wrapper { position: relative; display: flex; align-items: center; }
.password-input { width: 100%; padding-right: 2.6rem; }

.toggle-btn {
  position: absolute;
  right: .4rem;
  width: 2rem; height: 2rem;
  display: inline-grid; place-items: center;
  border: 0; background: transparent; cursor: pointer; border-radius: 8px;
}
.toggle-btn:hover { background: rgba(0,0,0,.035); }
.toggle-btn:focus-visible { outline: 2px solid var(--brand-400); outline-offset: 2px; }
.icon { width: 1.25rem; height: 1.25rem; fill: var(--brand-600); opacity:.8; }

/* --- Mensajes --- */
.error-message { color: #b91c1c; text-align: center; margin: .25rem 0; }

/* --- Botón principal con color de marca --- */
.auth-button {
  padding: .9rem 1rem;
  background: var(--brand-500);
  color: #fff;
  border: 1.5px solid color-mix(in oklab, var(--brand-500) 70%, white);
  border-radius: 10px;
  font-size: 1rem; font-weight: 700;
  cursor: pointer;
  transition: transform .02s ease, box-shadow .15s ease, filter .15s;
  box-shadow: 0 10px 24px color-mix(in oklab, var(--brand-500) 18%, transparent);
}
.auth-button:hover { filter: brightness(0.95); }
.auth-button:active { transform: translateY(1px); }
.auth-button:focus-visible { outline: 3px solid var(--brand-ring); }

.auth-button:disabled {
  background: #e5e7eb;
  border-color: #e5e7eb;
  color: #6b7280;
  cursor: not-allowed;
  box-shadow: none;
}

.auth-footer { margin-top: 1rem; text-align: center; color: var(--muted); }
.hint { margin-top: .25rem; font-size: .95rem; }
</style>
