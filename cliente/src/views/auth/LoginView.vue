<template>
  <div class="auth-container">
    <!-- HERO DE MARCA (reemplaza al H1) -->
    <div class="brand-hero" aria-label="Odes Construction">
      <img class="brand-hero__logo" :src="logoUrl" alt="Logo Odes Construction" />
      <div class="brand-hero__text">
        <div class="brand-hero__name">Odes Construction</div>
        <div class="brand-hero__sub">Acceso a intranet</div>
      </div>
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
import logoUrl from '@/assets/odes-mark.png'; // coloca aquí tu icono (svg o png)

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
/* ===== Paleta sobria (negros y grises) y tokens de marca ===== */
:root{
  --ink: #0f172a;             /* texto principal */
  --brand-ink: #4b5055;       /* “ink” corporativo */
  --g-300: #cdcdcd;
  --g-100: #f0f0f0;

  --line: #9ca3af;
  --line-strong: #6b7280;
  --ring: rgba(75,80,85,.25);

  --card: #ffffff;
  --btn-bg: #111827;          /* botón visible */
  --btn-bg-hover: #0b1220;
  --btn-text: #ffffff;
}

/* ===== Contenedor ===== */
.auth-container{
  max-width: 620px;
  margin: 3rem auto;
  padding: 2rem 2.25rem;
  border-radius: 18px;
  background: var(--card);
  border: 1px solid var(--g-300);
  box-shadow: 0 22px 60px rgba(15,23,42,.12);
  color: var(--ink);
}

/* ===== Lockup de marca (sustituye al H1) ===== */
/* Centrar el lockup (logo + textos) */
.brand-hero{
  display:flex;
  align-items:center;
  justify-content:center;   /* ← centra horizontalmente */
  gap:.9rem;
  margin-bottom:1rem;
  flex-wrap:wrap;           /* ← si hay poco ancho, permite salto a dos líneas */
}
.brand-hero__logo{
  width:48px; height:48px; object-fit:contain;
  filter: grayscale(100%);     /* monocromo sobrio */
}
.brand-hero__text{
  display:flex;
  flex-direction:column;
  line-height:1.05;
  text-align:center;        /* ← centra los textos respecto al logo */
}
@media (max-width: 420px){
  .brand-hero__logo{ width:42px; height:42px; }
}
.brand-hero__name{
  font-weight: 900;
  color:#111827;
  font-size: 1.35rem;          /* protagonista, reemplaza H1 */
  letter-spacing:.2px;
}
.brand-hero__sub{
  color:#6b7280;
  font-size:.9rem;
}

/* ===== Form ===== */
.auth-form{ display:flex; flex-direction:column; gap: 1.2rem; }
.form-group{ display:flex; flex-direction:column; gap:.55rem; }
label{ font-weight: 800; color:#111827; }

/* Inputs con contraste alto */
input{
  padding: .95rem 1rem;
  font-size: 1rem;
  border: 2px solid var(--line);
  border-radius: 12px;
  color: var(--ink);
  background: #fff;
  transition: border-color .15s, box-shadow .15s, background .15s;
}
input::placeholder{ color:#4b5563; opacity:1; }
input:hover{ border-color: var(--line-strong); }
input:focus{
  outline:0;
  border-color: #4b5055;        /* ink corporativo */
  box-shadow: 0 0 0 4px var(--ring);
}

/* Campo contraseña + ojito */
.password-wrapper{ position:relative; display:flex; align-items:center; }
.password-input{ width:100%; padding-right: 3rem; }
.toggle-btn{
  position:absolute; right:.5rem; top:50%; transform:translateY(-50%);
  width: 2.25rem; height: 2.25rem;
  display:inline-grid; place-items:center;
  border: 1px solid var(--g-300);
  background: var(--g-100);
  border-radius: 8px;
  cursor:pointer;
}
.toggle-btn:hover{ background:#e8ecf2; }
.toggle-btn:focus-visible{ outline:3px solid var(--ring); }
.icon{ width:1.15rem; height:1.15rem; fill:#111827; }

/* Mensajes de error */
.error-message{
  color:#b91c1c; background:#fef2f2; border:1px solid #fecaca;
  padding:.6rem .75rem; border-radius:12px; text-align:center;
}

/* ===== Botón visible ===== */
.auth-button{
  padding: 1rem;
  background: var(--btn-bg);
  color: var(--btn-text);
  border: 0;
  border-radius: 12px;
  font-weight: 900;
  letter-spacing:.2px;
  cursor:pointer;
  transition: transform .02s ease, filter .15s, box-shadow .15s;
  box-shadow: 0 16px 36px rgba(0,0,0,.20);
}
.auth-button:hover{ background: var(--btn-bg-hover); }
.auth-button:active{ transform: translateY(1px); }
.auth-button:focus-visible{ outline: 4px solid var(--ring); }
.auth-button:disabled{ background:#9ca3af; color:#1f2937; box-shadow:none; cursor:not-allowed; }

/* Footer */
.auth-footer{ margin-top: 1rem; text-align:center; color:#4b5563; }
.hint{ margin-top:.25rem; font-size:.95rem; }
</style>
