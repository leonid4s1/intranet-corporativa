<template>
  <div class="email-verification-container">
    <div class="verification-card">
      <!-- Con token en la URL: /verify-email/:token -->
      <template v-if="hasToken">
        <h1>Verificación de Email</h1>

        <div class="verification-info">
          <p v-if="userEmail">
            Estamos verificando la cuenta de <strong>{{ userEmail }}</strong>
          </p>
          <p>Te redirigiremos automáticamente para completar la verificación…</p>
        </div>

        <div v-if="verificationStatus" class="status-message" :class="statusType">
          <span>{{ verificationStatus }}</span>
        </div>

        <div class="action-buttons">
          <button class="login-link" @click="backToLogin">
            Volver al login
          </button>
        </div>
      </template>

      <!-- Sin token: pantalla de "correo enviado" + sondeo -->
      <template v-else>
        <template v-if="!isVerified">
          <h1>Correo de verificación enviado</h1>
          <p>
            Hemos enviado un enlace de verificación a
            <strong>{{ userEmail || 'tu correo' }}</strong>.
          </p>
          <p>Por favor revisa tu bandeja de entrada y haz click en el enlace para activar tu cuenta.</p>

          <div v-if="verificationStatus" class="status-message" :class="statusType">
            <span>{{ verificationStatus }}</span>
          </div>

          <div class="action-buttons">
            <button
              @click="resendVerification"
              :disabled="isResending || resendCooldown > 0 || !userEmail"
              class="resend-button"
            >
              <template v-if="isResending">
                <LoadingSpinner size="small" />
                Enviando…
              </template>
              <template v-else-if="resendCooldown > 0">
                Reenviar en {{ resendCooldown }}s
              </template>
              <template v-else>
                Reenviar correo
              </template>
            </button>

            <button class="login-link" @click="backToLogin">
              Volver al login
            </button>
          </div>
        </template>

        <template v-else>
          <div class="verification-success">
            <CheckCircleIcon class="success-icon" />
            <h2>¡Email verificado con éxito!</h2>
            <p>Tu dirección de email ha sido confirmada correctamente.</p>
            <router-link
              :to="{ name: authStore.isAdmin ? 'admin-dashboard' : 'home' }"
              class="dashboard-button"
            >
              Continuar
            </router-link>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isVerified = ref(false);
const isResending = ref(false);
const resendCooldown = ref(0);
const verificationStatus = ref('');
const statusType = ref<'success' | 'error'>('success');

// email: prioriza query, luego store
const userEmail = ref<string>(
  (route.query.email as string) || authStore.user?.email || ''
);

// hay token si ruta es /verify-email/:token
const hasToken = ref<boolean>(!!route.params.token);

// id del intervalo (browser devuelve number)
let verificationInterval: number | undefined;

// Base absoluta del API para redirigir al endpoint de verificación (que hace redirect al front)
const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';
const apiBaseSanitized = API_BASE.replace(/\/+$/, '');

// Redirige al endpoint del backend que valida el token y redirige al front
function redirectToBackendVerify(token: string) {
  verificationStatus.value = 'Redirigiendo para completar la verificación…';
  statusType.value = 'success';

  const url = `${apiBaseSanitized}/auth/verify-email/${encodeURIComponent(token)}`;
  // Navegación de página completa para respetar cookies/redirect del backend
  window.location.assign(url);
}

async function resendVerification() {
  if (!userEmail.value) return;
  isResending.value = true;
  verificationStatus.value = 'Enviando correo de verificación…';
  statusType.value = 'success';

  try {
    const { success, sent, message } = await authStore.resendVerificationEmail(userEmail.value);
    if (success && sent) {
      verificationStatus.value = message || 'Correo reenviado correctamente.';
      startResendCooldown();
    } else {
      throw new Error(message || 'Error al reenviar el correo');
    }
  } catch (error) {
    statusType.value = 'error';
    verificationStatus.value =
      error instanceof Error ? error.message : 'Error desconocido al reenviar';
  } finally {
    isResending.value = false;
  }
}

function startResendCooldown() {
  resendCooldown.value = 60;
  const id = window.setInterval(() => {
    if (resendCooldown.value > 0) resendCooldown.value--;
    else window.clearInterval(id);
  }, 1000);
}

// Sondeo periódico para detectar verificación (cuando no hay token)
function startVerificationCheck() {
  verificationInterval = window.setInterval(async () => {
    try {
      await authStore.fetchUser();
      if (authStore.isEmailVerified) {
        isVerified.value = true;
        if (verificationInterval) window.clearInterval(verificationInterval);
        const redirectRoute = authStore.isAdmin ? 'admin-dashboard' : 'home';
        router.push({ name: redirectRoute });
      }
    } catch {
      // ignoramos errores intermitentes
    }
  }, 5000);
}

async function backToLogin() {
  authStore.clearAuth(); // clave para que el guard NO te regrese a verify-email
  await router.replace({ name: 'login' });
}

onMounted(() => {
  // refresca email si llega por query
  if (route.query.email && !userEmail.value) {
    userEmail.value = String(route.query.email);
  }

  if (hasToken.value && route.params.token) {
    // flujo por URL: dejamos que el backend maneje el token y redirija
    redirectToBackendVerify(String(route.params.token));
  } else if (authStore.isAuthenticated && !authStore.isEmailVerified) {
    verificationStatus.value = 'Correo de verificación enviado. Revisa tu email.';
    statusType.value = 'success';
    startVerificationCheck();
  } else if (authStore.isEmailVerified) {
    isVerified.value = true;
  } else if (userEmail.value) {
    verificationStatus.value = 'Correo de verificación enviado. Revisa tu email.';
    statusType.value = 'success';
  }
});

// si el token cambia dinámicamente
watch(
  () => route.params.token,
  (newToken) => {
    if (newToken) {
      hasToken.value = true;
      redirectToBackendVerify(String(newToken));
    }
  }
);

onBeforeUnmount(() => {
  if (verificationInterval) window.clearInterval(verificationInterval);
});
</script>

<style scoped>
.email-verification-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 2rem;
  background-color: #f5f7fa;
}
.verification-card {
  width: 100%;
  max-width: 500px;
  padding: 2.5rem;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  text-align: center;
}
h1 { color: #2c3e50; margin-bottom: 1.5rem; font-size: 1.8rem; }
.verification-info { margin-bottom: 1.5rem; color: #4a5568; }
.verification-info p { margin-bottom: 0.5rem; }
.status-message { padding: .75rem; border-radius: 8px; margin: 1.5rem 0; font-weight: 500; }
.status-message.success { background:#f0fff4; color:#2f855a; border:1px solid #c6f6d5; }
.status-message.error { background:#fff5f5; color:#c53030; border:1px solid #fed7d7; }
.action-buttons { display:flex; flex-direction:column; gap:1rem; margin-top:2rem; }
.resend-button {
  padding:.75rem 1.5rem; background:#4299e1; color:#fff; border:none; border-radius:8px;
  font-weight:500; cursor:pointer; transition:background-color .2s; display:flex; align-items:center; justify-content:center; gap:.5rem;
}
.resend-button:hover:not(:disabled){ background:#3182ce; }
.resend-button:disabled{ background:#a0aec0; cursor:not-allowed; }
.login-link {
  padding:.75rem 1.5rem; background:transparent; color:#4299e1; border:1px solid #4299e1;
  border-radius:8px; font-weight:500; cursor:pointer;
}
.login-link:hover { color:#3182ce; border-color:#3182ce; }
.verification-success { display:flex; flex-direction:column; align-items:center; gap:1rem; }
.success-icon { width:72px; height:72px; color:#48bb78; margin-bottom:1rem; }
.verification-success h2 { color:#2f855a; font-size:1.5rem; margin-bottom:.5rem; }
.verification-success p { color:#4a5568; margin-bottom:1.5rem; }
.dashboard-button { padding:.75rem 1.5rem; background:#48bb78; color:#fff; border:none; border-radius:8px; font-weight:500; text-decoration:none; }
.dashboard-button:hover { background:#38a169; }
</style>
