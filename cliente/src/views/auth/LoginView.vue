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
/* === Tokens (con fallbacks) === */
:root{
  --brand: var(--brand-ink, #1f2937);             /* gris corporativo oscuro */
  --brand-700: color-mix(in oklab, var(--brand) 85%, black);
  --brand-600: color-mix(in oklab, var(--brand) 75%, black);
  --brand-500: var(--brand);
  --ring: color-mix(in oklab, var(--brand) 25%, transparent);

  --ink: #0f172a;          /* texto principal (muy oscuro) */
  --muted: #374151;        /* texto secundario con buen contraste */
  --line: #9ca3af;         /* borde de inputs (≥3:1 sobre blanco) */
  --line-strong: #6b7280;  /* hover */
  --bg: #ffffff;
}

/* === Card/Login === */
.auth-container{
  max-width: 520px;
  margin: 3rem auto;
  padding: 2rem 2.25rem;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid #e5e7eb;
  box-shadow: 0 12px 36px rgba(15,23,42,.10);
  color: var(--ink);
}

h1{
  text-align: center;
  color: var(--ink);
  margin-bottom: 1.25rem;
  font-weight: 800;
  letter-spacing: .2px;
}
h1::after{
  content:"";
  display:block;
  width:64px;height:3px;
  margin:.6rem auto 0;
  background: var(--brand-600);
  border-radius: 999px;
}

/* === Form === */
.auth-form{ display:flex; flex-direction:column; gap: 1.2rem; }
.form-group{ display:flex; flex-direction:column; gap:.5rem; }
label{ font-weight: 700; color: var(--ink); }

/* Inputs con contraste alto */
input{
  padding: .9rem 1rem;
  font-size: 1rem;
  border: 2px solid var(--line);
  border-radius: 10px;
  color: var(--ink);                /* texto oscuro */
  background: #ffffff;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
input::placeholder{
  color: #4b5563;                  /* placeholder más visible (≥4.5:1 sobre blanco) */
  opacity: 1;
}
input:hover{ border-color: var(--line-strong); }
input:focus{
  outline: 0;
  border-color: var(--brand-600);
  box-shadow: 0 0 0 4px var(--ring);
  background: #fff;
}

/* Password + ojito */
.password-wrapper{ position: relative; display:flex; align-items:center; }
.password-input{ width:100%; padding-right: 2.75rem; }
.toggle-btn{
  position:absolute; right:.45rem;
  width: 2.1rem; height: 2.1rem;
  display:inline-grid; place-items:center;
  border: 1px solid #e5e7eb;
  background:#f9fafb;
  border-radius: 8px;
  cursor:pointer;
}
.toggle-btn:hover{ background:#eef2ff; border-color:#c7d2fe; }
.toggle-btn:focus-visible{ outline: 3px solid var(--ring); }
.icon{ width: 1.1rem; height:1.1rem; fill: var(--brand-700); }

/* Mensajes */
.error-message{
  color:#b91c1c;
  background:#fef2f2;
  border:1px solid #fecaca;
  padding:.55rem .7rem;
  border-radius:10px;
  text-align:center;
}

/* Botón con contraste AA sobre fondo */
.auth-button{
  padding: .95rem 1rem;
  background: var(--brand-700);     /* suficientemente oscuro */
  color: #ffffff;                   /* contraste ≥ 4.5:1 */
  border: 2px solid color-mix(in oklab, var(--brand-700) 70%, white);
  border-radius: 12px;
  font-weight: 800;
  letter-spacing:.2px;
  cursor:pointer;
  transition: transform .02s ease, filter .15s, box-shadow .15s;
  box-shadow: 0 12px 28px color-mix(in oklab, var(--brand-700) 18%, transparent);
}
.auth-button:hover{ filter: brightness(.95); }
.auth-button:active{ transform: translateY(1px); }
.auth-button:focus-visible{ outline: 4px solid var(--ring); }

.auth-button:disabled{
  background:#9ca3af;
  border-color:#9ca3af;
  color:#111827;
  cursor: not-allowed;
  box-shadow:none;
}

/* Footer */
.auth-footer{ margin-top: 1rem; text-align:center; color: var(--muted); }
.hint{ margin-top:.25rem; font-size:.95rem; }
</style>
