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
          placeholder="tu@email.com"
        />
      </div>

      <div class="form-group">
        <label for="password">Contraseña:</label>
        <input
          type="password"
          id="password"
          v-model="password"
          required
          placeholder="Tu contraseña"
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <button type="submit" :disabled="isLoading" class="auth-button">
        {{ isLoading ? 'Cargando...' : 'Ingresar' }}
      </button>
    </form>

    <div class="auth-footer">
      <p>¿No tienes una cuenta?</p>
      <router-link to="/register" class="register-button">
        Regístrate aquí
      </router-link>
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
      email: email.value,
      password: password.value,
    });

    const dest =
      safeDecodeRedirect(route.query.redirect) ??
      (authStore.isAdmin ? '/admin' : '/home');

    router.replace(dest);
  } catch (err: unknown) {
    error.value = extractErrorMessage(err);
    console.error('Error detallado en login:', err);
  } finally {
    isLoading.value = false;
  }
};

// Usuario ya autenticado no debe quedarse en /login
if (authStore.isAuthenticated) {
  router.replace(authStore.isAdmin ? '/admin' : '/home');
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

.register-button {
  display: inline-block;
  margin-top: 0.5rem;
  color: #3498db;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.register-button:hover {
  color: #2980b9;
  text-decoration: underline;
}
</style>
