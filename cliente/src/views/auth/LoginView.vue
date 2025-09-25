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
.auth-container {
  max-width: 400px;
  margin: 2rem auto;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 1.5rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: #2c3e50;
}

input {
  padding: 0.8rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

/* --- Estilos para el campo de contraseña con ojito --- */
.password-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.password-input {
  width: 100%;
  padding-right: 2.6rem; /* espacio para el botón */
}
.toggle-btn {
  position: absolute;
  right: 0.4rem;
  width: 2rem;
  height: 2rem;
  display: inline-grid;
  place-items: center;
  border: 0;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
}
.toggle-btn:focus-visible {
  outline: 2px solid #3498db;
  outline-offset: 2px;
}
.icon {
  width: 1.25rem;
  height: 1.25rem;
  fill: #5b667b;
}

.error-message {
  color: #e74c3c;
  text-align: center;
  margin: 0.5rem 0;
}

.auth-button {
  padding: 0.8rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

.auth-button:hover {
  background-color: #2980b9;
}

.auth-button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
  color: #7f8c8d;
}

.hint {
  margin-top: 0.5rem;
  font-size: 0.95rem;
}
</style>
