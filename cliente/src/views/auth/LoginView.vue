<template>
  <div class="auth-container">
    <!-- HERO DE MARCA: lockup completo -->
    <div class="brand-hero" aria-label="Odes Construction">
      <img class="brand-lockup" :src="lockupUrl" alt="Odes Construction" />
    </div>

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
      <p class="hint">¿Problemas para entrar? Contacta al administrador.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import lockupUrl from '@/assets/brand/odes-lockup.png';

const isLoading = ref(false);
const email = ref('');
const password = ref('');
const error = ref('');
const showPassword = ref(false);

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

type ApiErrorData = { message?: string };
type AxiosLikeError = { message?: string; response?: { data?: ApiErrorData } };

function safeDecodeRedirect(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const dec = decodeURIComponent(raw);
    if (dec.startsWith('/') && !dec.startsWith('//') && dec !== '/login') return dec;
    return null;
  } catch { return null; }
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as AxiosLikeError;
    const apiMsg = e.response?.data?.message;
    if (typeof apiMsg === 'string' && apiMsg.trim()) return apiMsg;
    if (typeof e.message === 'string' && e.message.trim()) return e.message;
  }
  return 'Error al iniciar sesión. Intente nuevamente';
}

const handleSubmit = async () => {
  isLoading.value = true;
  error.value = '';
  try {
    await authStore.login({ email: email.value.trim(), password: password.value.trim() });
    const redirectPath = safeDecodeRedirect(route.query.redirect);
    if (redirectPath) return router.replace(redirectPath);
    return router.replace({ name: authStore.isAdmin ? 'admin-dashboard' : 'home' });
  } catch (err: unknown) {
    error.value = extractErrorMessage(err);
    console.error('Error detallado en login:', err);
  } finally {
    isLoading.value = false;
  }
};

if (authStore.isAuthenticated) {
  router.replace({ name: authStore.isAdmin ? 'admin-dashboard' : 'home' });
}
</script>

<style scoped>
:root{
  --ink:#0f172a;
  --brand-ink:#4b5055;
  --g-300:#e5e7eb;
  --g-200:#eef1f4;
  --g-100:#f7f8fa;
  --line:#c7cdd6;
  --line-strong:#98a2b3;
  --ring:rgba(75,80,85,.25);

  --card:#ffffff;
  --btn-bg:#111827;
  --btn-bg-hover:#0b1220;
  --btn-text:#ffffff;
}

/* fuentes */
.auth-container,
label,
input,
.toggle-btn,
.auth-button,
.hint,
.error-message{
  font-family: var(--font-brand), system-ui, -apple-system,"Segoe UI",Roboto,Arial,sans-serif !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Card más compacta y centrada visualmente */
.auth-container{
  max-width: 600px;
  margin: 5vh auto; /* más respiración superior/inferior */
  padding: 1.75rem 1.9rem;
  border-radius: 18px;
  background: var(--card);
  border: 1px solid var(--g-300);
  box-shadow: 0 20px 50px rgba(15,23,42,.10);
  color: var(--ink);
}

/* HERO con lockup */
.brand-hero{
  display:flex; align-items:center; justify-content:center;
  margin-bottom: 1.1rem;
}
.brand-lockup{
  width: min(520px, 88%);
  height:auto;
  image-rendering:-webkit-optimize-contrast;
  /* leve nitidez */
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.05));
}
@media (max-width: 380px){
  .brand-lockup{ width: min(320px, 92%); }
}

/* Form */
.auth-form{ display:flex; flex-direction:column; gap: 1rem; }
.form-group{ display:flex; flex-direction:column; gap:.5rem; }
label{
  font-weight: 700;       /* menos pesado que 800 */
  color:#111827;
  letter-spacing:0;
  font-size: .98rem;
}

/* Inputs */
input{
  padding: .9rem 1rem;
  font-size: 1rem;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  color: var(--ink);
  background: var(--g-100);
  transition: border-color .15s, box-shadow .15s, background .15s, transform .02s;
  font-weight: 500;
}
input::placeholder{ color:#6b7280; opacity:1; }
input:hover{ background: var(--g-200); border-color: var(--line-strong); }
input:focus{
  outline:0;
  background:#fff;
  border-color: var(--brand-ink);
  box-shadow: 0 0 0 4px var(--ring);
}

/* Campo contraseña + ojito */
.password-wrapper{ position:relative; display:flex; align-items:center; }
.password-input{ width:100%; padding-right: 2.8rem; }
.toggle-btn{
  position:absolute; right:.45rem; top:50%; transform:translateY(-50%);
  width: 2.1rem; height: 2.1rem;
  display:inline-grid; place-items:center;
  border: 1px solid var(--g-300);
  background: #fff;
  border-radius: 10px;
  cursor:pointer;
  transition: box-shadow .15s, border-color .15s, transform .02s;
}
.toggle-btn:hover{ border-color: var(--line-strong); }
.toggle-btn:active{ transform: translateY(1px); }
.toggle-btn:focus-visible{ outline:3px solid var(--ring); }
.icon{ width:1.1rem; height:1.1rem; fill:#111827; }

/* Error */
.error-message{
  color:#b91c1c; background:#fef2f2; border:1px solid #fecaca;
  padding:.6rem .75rem; border-radius:12px; text-align:center;
  font-weight:700;
}

/* Botón */
.auth-button{
  padding: 0.95rem;
  width: 100%;
  background: var(--btn-bg);
  color: var(--btn-text);
  border: 0;
  border-radius: 12px;
  font-weight: 900;
  letter-spacing:.2px;
  cursor:pointer;
  transition: transform .02s ease, filter .15s, box-shadow .15s, background .15s;
  box-shadow: 0 12px 28px rgba(0,0,0,.18);
}
.auth-button:hover{ background: var(--btn-bg-hover); }
.auth-button:active{ transform: translateY(1px); }
.auth-button:focus-visible{ outline: 4px solid var(--ring); }
.auth-button:disabled{ background:#9ca3af; color:#1f2937; box-shadow:none; cursor:not-allowed; }

/* Footer */
.auth-footer{ margin-top: 1rem; text-align:center; color:#4b5563; }
.hint{ margin-top:.25rem; font-size:.95rem; font-weight:500; }
</style>
