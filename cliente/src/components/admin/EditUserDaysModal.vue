<!-- cliente/src/components/admin/EditUserDaysModal.vue -->
<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Editar Días de Vacaciones</h3>
        <button class="close-btn" @click="$emit('cancel')" aria-label="Cerrar">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <form @submit.prevent="submit" class="vacation-form">
        <div class="form-group highlight">
          <label class="form-label">Total:</label>
          <input
            type="number"
            v-model.number="form.total"
            class="form-input editable"
            required
            min="0"
          >
          <p v-if="showWarning" class="warning-message">
            <i class="fas fa-exclamation-circle"></i> {{ warningText }}
          </p>
        </div>

        <div class="form-group">
          <label class="form-label">Usados:</label>
          <input
            type="number"
            v-model.number="form.used"
            class="form-input"
            disabled
          >
        </div>

        <div class="form-group">
          <label class="form-label">Disponibles:</label>
          <input
            type="number"
            v-model.number="form.remaining"
            class="form-input"
            disabled
          >
        </div>

        <div class="modal-actions">
          <button type="button" class="btn cancel-btn" @click="$emit('cancel')">
            Cancelar
          </button>
          <button type="submit" class="btn submit-btn">
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { VacationDays, User } from '@/types/user';

const props = defineProps<{
  user: User
}>();

const emit = defineEmits<{
  (e: 'submit', data: { userId: string, vacationDays: VacationDays }): void;
  (e: 'cancel'): void;
}>();

const form = ref({
  total: props.user.vacationDays?.total ?? 0,
  used: props.user.vacationDays?.used ?? 0,
  remaining: props.user.vacationDays?.remaining ?? 0
});

const showWarning = ref(false);
const warningText = ref('');

watch(() => props.user, (newUser) => {
  form.value = {
    total: newUser.vacationDays?.total ?? 0,
    used: newUser.vacationDays?.used ?? 0,
    remaining: newUser.vacationDays?.remaining ?? 0
  };
}, { immediate: true });

watch(() => form.value.total, (newTotal) => {
  if (newTotal < form.value.used) {
    showWarning.value = true;
    warningText.value = 'El total no puede ser menor que los días usados';
  } else {
    showWarning.value = false;
    // Actualizar automáticamente los disponibles
    form.value.remaining = newTotal - form.value.used;
  }
});

const submit = () => {
  if (form.value.total >= form.value.used) {
    emit('submit', {
      userId: props.user.id,
      vacationDays: {
        total: form.value.total,
        used: form.value.used,
        remaining: form.value.total - form.value.used
      }
    });
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 400px;
  overflow: hidden;
  animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  margin: 0;
  color: #2c3e50;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #7f8c8d;
  font-size: 1.2rem;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #e74c3c;
}

.vacation-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.2rem;
}

.form-group.highlight {
  background-color: #f5f9ff;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  color: #34495e;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.form-input.editable {
  border-color: #3498db;
  background-color: #fff;
}

.form-input:disabled {
  background-color: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 0.95rem;
}

.cancel-btn {
  background-color: #f5f5f5;
  color: #7f8c8d;
}

.cancel-btn:hover {
  background-color: #e0e0e0;
}

.submit-btn {
  background-color: #3498db;
  color: white;
}

.submit-btn:hover {
  background-color: #2980b9;
}

/* Validación visual para el input */
.form-input.editable:invalid {
  border-color: #e74c3c;
}

.form-input.editable:valid {
  border-color: #2ecc71;
}
</style>
