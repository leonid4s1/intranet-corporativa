<template>
  <div class="holiday-form-container">
    <h3>Agregar Dia Festivo</h3>

    <form @submit.prevent="handleSubmit" class="holiday-form">
      <div class="form-group">
        <label for="name">Nombre del festivo *</label>
        <input
          id="name"
          v-model="form.name"
          type="text"
          required
          minlength="5"
          maxlength="100"
          placeholder="Ej: Día de la Independencia"
          :class="{ 'input-error': fieldErrors.name }"
          @input="validateName"
        />
        <span class="char-counter"> {{ form.name.length }}/100</span>
        <span v-if="fieldErrors.name" class="error-text">{{ fieldErrors.name }}</span>
      </div>

      <div class="form-group">
        <label for="date">Fecha *</label>
        <input
          id="date"
          v-model="form.date"
          type="date"
          required
          :min="minDate"
          :class="{ 'input-error': fieldErrors.date }"
          @change="validateDate"
        />
        <span v-if="fieldErrors.date" class="error-text">{{ fieldErrors.date }}</span>
      </div>

      <div class="form-group">
        <label>
          <input
            type="checkbox"
            v-model="form.recurring"
          />
          Festivo recurrente (se repite cada año)
        </label>
      </div>

      <div class="form-group">
        <label for="description">Descripcion (opcional)</label>
        <textarea
          id="description"
          v-model="form.description"
          maxlength="500"
          placeholder="Breve descripcion del festivo"
        ></textarea>
        <span class="char-counter">{{ form.description.length }}</span>
      </div>

      <div class="form-actions">
        <button
          type="button"
          class="btn-cancel"
          @click="handleCancel"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="btn-submit"
          :disabled="loading"
        >
          <span v-if="loading">Guardando...</span>
          <span v-else>Guardar Festivo</span>
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import holidayService from '@/services/holiday.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Extiende Day.js con el plugin UTC
dayjs.extend(utc);

const emit = defineEmits(['submit', 'cancel']);

const loading = ref(false);
const error = ref('');
const fieldErrors = reactive({
  name: '',
  date: ''
});

const form = ref({
  name: '',
  date: '',
  recurring: false,
  description: ''
});

const minDate = computed(() => {
  const today = new Date();
  return today.toISOString().split('T')[0];
});

const validateName = () => {
  fieldErrors.name = '';
  const name = form.value.name.trim();
  if (!name) {
    fieldErrors.name = 'El nombre es obligatorio';
    return false;
  }
  if (name.length < 5) {
    fieldErrors.name = 'El nombre debe tener al menos 5 caracteres';
    return false;
  }
  return true;
};

const validateDate = () => {
  fieldErrors.date = '';
  if (!form.value.date) {
    fieldErrors.date = 'La fecha es obligatoria';
    return false;
  }

  const dateObj = new Date(form.value.date);
  if (isNaN(dateObj.getTime())) {
    fieldErrors.date = 'Fecha invalida';
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObj < today) {
    fieldErrors.date = 'La fecha no puede ser en el pasado';
    return false;
  }
  return true;
};

const validateForm = () => {
  const isNameValid = validateName();
  const isDateValid = validateDate();
  return isNameValid && isDateValid;
};

const handleSubmit = async () => {
  try {
    if (!validateForm()) return;

    loading.value = true;
    error.value = '';

    const holidayData = {
      name: form.value.name.trim(),
      date: dayjs(form.value.date).utc().format('YYYY-MM-DD'),
      recurring: form.value.recurring,
      description: form.value.description?.trim() || undefined
    };

    const createdHoliday = await holidayService.createHoliday(holidayData);

    emit('submit', createdHoliday);

    resetForm();
  } catch (err: any) {
    error.value = err.message || 'Error al crear el dia festivo';
    console.error('Error en HolidayForm:', err);
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  resetForm();
  emit('cancel');
};

const resetForm = () => {
  form.value = {
    name: '',
    date: '',
    recurring: false,
    description: ''
  };
  error.value = '';
  fieldErrors.name = '';
  fieldErrors.date = '';
};
</script>

<style scoped>
.holiday-form-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.holiday-form-container h3 {
  margin-top: 0;
  color: #2c3e50;
  text-align: center;
}

.holiday-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-weight: 500;
  color: #34495e;
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.char-counter {
  font-size: 12px;
  color: #7f8c8d;
  text-align: right;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

.btn-cancel, .btn-submit {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel {
  background-color: #f5f5f5;
  color: #7f8c8d;
}

.btn-cancel:hover {
  background-color: #e0e0e0;
}

.btn-submit {
  background-color: #3498db;
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background-color: #2980b9;
}

.btn-submit:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.error-message {
  color: #e74c3c;
  padding: 10px;
  background-color: #fdecea;
  border-radius: 4px;
  margin-top: 10px;
  font-size: 14px;
}

.input-error {
  border-color: #e74c3c !important;
}

.error-text {
  color: #e74c3c;
  font-size: 0.8rem;
  margin-top: 0.2rem;
  display: block;
}
</style>
