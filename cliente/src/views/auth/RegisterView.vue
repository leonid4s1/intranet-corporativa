<template>
  <div class="auth-container">
    <h1 class="auth-title">Crear Cuenta</h1>

    <form @submit.prevent="handleSubmit" class="auth-form" novalidate>
      <div class="form-group">
        <label for="name">Nombre completo:</label>
        <input
          type="text"
          id="name"
          v-model.trim="form.name"
          @blur="validateName"
          required
          placeholder="Tu nombre completo"
          :class="{ 'input-error': errors.name }"
          :disabled="isLoading"
        />
        <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
      </div>

      <div class="form-group">
        <label for="email">Correo electrónico:</label>
        <input
          type="email"
          id="email"
          v-model.trim="form.email"
          @blur="validateEmail"
          required
          placeholder="tu@email.com"
          :class="{ 'input-error': errors.email }"
          :disabled="isLoading"
        />
        <span v-if="errors.email" class="error-text">{{ errors.email }}</span>
      </div>

      <div class="form-group">
        <label for="password">Contraseña:</label>
        <div class="password-input-wrapper">
          <input
            :type="showPassword ? 'text' : 'password'"
            id="password"
            v-model.trim="form.password"
            @input="validatePassword"
            required
            placeholder="Mínimo 8 caracteres"
            minlength="8"
            :class="{ 'input-error': errors.password }"
            :disabled="isLoading"
          />
          <button
            type="button"
            class="password-toggle"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          >
            <EyeIcon :visible="showPassword" />
          </button>
        </div>
        <PasswordStrengthMeter
          :password="form.password"
          @validation="updatePasswordValidation"
        />
        <span v-if="errors.password" class="error-text">{{ errors.password }}</span>
      </div>

      <div class="form-group">
        <label for="password_confirmation">Confirmar contraseña:</label>
        <div class="password-input-wrapper">
          <input
            :type="showConfirmPassword ? 'text' : 'password'"
            id="password_confirmation"
            v-model.trim="form.password_confirmation"
            @blur="validatePasswordConfirmation"
            required
            placeholder="Repite tu contraseña"
            minlength="8"
            :class="{ 'input-error': errors.password_confirmation }"
            :disabled="isLoading"
          />
          <button
            type="button"
            class="password-toggle"
            @click="showConfirmPassword = !showConfirmPassword"
            :aria-label="showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          >
            <EyeIcon :visible="showConfirmPassword" />
          </button>
        </div>
        <span v-if="errors.password_confirmation" class="error-text">
          {{ errors.password_confirmation }}
        </span>
      </div>

      <div v-if="serverError" class="server-error">
        <ExclamationCircleIcon />
        <span>{{ serverError }}</span>
      </div>

      <button
        type="submit"
        :disabled="isLoading || !isFormValid"
        class="auth-button"
        :class="{ loading: isLoading }"
      >
        <template v-if="!isLoading">Registrarse</template>
        <template v-else>
          <LoadingSpinner class="inline mr-2" />
          Procesando...
        </template>
      </button>
    </form>

    <div class="auth-footer">
      <p>¿Ya tienes una cuenta?</p>
      <router-link to="/login" class="auth-link">
        Inicia sesión aquí
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { isAxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import EyeIcon from '@/components/icons/EyeIcon.vue';
import ExclamationCircleIcon from '@/components/icons/ExclamationCircleIcon.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter.vue';

/* ------------------------- Tipos locales ------------------------- */
interface FormState {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
interface ErrorState {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}
interface PasswordValidationState {
  hasMinLength: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  hasUppercase: boolean;
}

/* Errores del backend tipados (dos formatos posibles) */
type FieldErrorItem = { msg: string; param?: keyof ErrorState };
type ErrorMap = Record<string, string | string[]>;
interface ServerErrorData {
  message?: string;
  error?: string;
  errors?: FieldErrorItem[] | ErrorMap;
}

/* Type guards para no usar `any` */
const isFieldErrorArray = (v: unknown): v is FieldErrorItem[] =>
  Array.isArray(v) && v.every(it => it && typeof it.msg === 'string');

const isErrorMap = (v: unknown): v is ErrorMap =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/* ------------------------- Estado ------------------------- */
const router = useRouter();
const authStore = useAuthStore();

const isLoading = ref<boolean>(false);
const serverError = ref<string>('');

const showPassword = ref<boolean>(false);
const showConfirmPassword = ref<boolean>(false);

const passwordValidation = ref<PasswordValidationState>({
  hasMinLength: false,
  hasNumber: false,
  hasSpecialChar: false,
  hasUppercase: false
});

const form = ref<FormState>({
  name: '',
  email: '',
  password: '',
  password_confirmation: ''
});

const errors = ref<ErrorState>({
  name: '',
  email: '',
  password: '',
  password_confirmation: ''
});

/* ------------------------- Validaciones ------------------------- */
const isFormValid = computed(() => {
  const nameOk = form.value.name.trim().length >= 3;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email);
  const passOk = form.value.password.length >= 8;
  const matchOk = form.value.password === form.value.password_confirmation;
  const noClientErrors = !Object.values(errors.value).some(Boolean);
  return nameOk && emailOk && passOk && matchOk && noClientErrors;
});

const validateName = () => {
  const n = form.value.name.trim();
  errors.value.name = !n ? 'El nombre es requerido' : n.length < 3 ? 'Mínimo 3 caracteres' : '';
};
const validateEmail = () => {
  const e = form.value.email.trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  errors.value.email = !e ? 'El email es requerido' : !re.test(e) ? 'Email inválido' : '';
};
const validatePassword = () => {
  const p = form.value.password;
  errors.value.password = !p ? 'La contraseña es requerida' : p.length < 8 ? 'Mínimo 8 caracteres' : '';
};
const validatePasswordConfirmation = () => {
  const pc = form.value.password_confirmation;
  errors.value.password_confirmation = !pc
    ? 'Confirma tu contraseña'
    : form.value.password !== pc
    ? 'Las contraseñas no coinciden'
    : '';
};

const updatePasswordValidation = (validation: PasswordValidationState) => {
  passwordValidation.value = validation;
};

/* ------------------------- Submit ------------------------- */
const handleSubmit = async () => {
  serverError.value = '';
  isLoading.value = true;

  // Validación previa
  validateName();
  validateEmail();
  validatePassword();
  validatePasswordConfirmation();

  if (!isFormValid.value) {
    isLoading.value = false;
    return;
  }

  try {
    const payload = {
      name: form.value.name.trim(),
      email: form.value.email.trim().toLowerCase(),
      password: form.value.password,
      password_confirmation: form.value.password_confirmation
    };

    await authStore.register(payload);
    router.push({ name: 'email-verification', query: { force: 'true' } });
  } catch (err: unknown) {
    console.error('Error en registro:', err);

    // limpia errores previos
    (Object.keys(errors.value) as Array<keyof ErrorState>).forEach(k => (errors.value[k] = ''));

    if (isAxiosError(err)) {
      const data: ServerErrorData | undefined = err.response?.data;

      if (data?.errors) {
        if (isFieldErrorArray(data.errors)) {
          data.errors.forEach(fe => {
            if (fe.param) errors.value[fe.param] = fe.msg || 'Campo inválido';
          });
        } else if (isErrorMap(data.errors)) {
          Object.entries(data.errors).forEach(([field, messages]) => {
            if (field in errors.value) {
              const key = field as keyof ErrorState;
              errors.value[key] = Array.isArray(messages) ? messages.join(', ') : String(messages);
            }
          });
        }
      }

      serverError.value = data?.message || data?.error || err.message || 'Error de conexión';
    } else if (err instanceof Error) {
      serverError.value = err.message;
    } else {
      serverError.value = 'Ocurrió un error inesperado';
    }
  } finally {
    isLoading.value = false;
  }
};

/* Sincroniza validación de confirmación al escribir */
watch(() => form.value.password_confirmation, validatePasswordConfirmation);
</script>

<style scoped>
.auth-container {
  max-width: 450px;
  margin: 2rem auto;
  padding: 2rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.auth-title {
  text-align: center;
  margin-bottom: 1.5rem;
  color: var(--primary-color);
  font-size: 1.8rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: var(--text-color);
}

input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
  width: 100%;
}

input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
}

.input-error {
  border-color: var(--error-color) !important;
}

.error-text {
  color: var(--error-color);
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: var(--text-secondary);
}

.server-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--error-color);
  background-color: var(--error-bg);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.auth-button {
  padding: 0.75rem;
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  margin-top: 1rem;
  font-size: 1rem;
  font-weight: 500;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 48px;
}

.auth-button:hover:not(:disabled) {
  background-color: var(--primary-dark);
}

.auth-button:disabled {
  background-color: var(--disabled-color);
  cursor: not-allowed;
}

.auth-button.loading {
  background-color: var(--primary-light);
}

.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.auth-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  margin-left: 0.25rem;
}

.auth-link:hover {
  text-decoration: underline;
}
</style>
