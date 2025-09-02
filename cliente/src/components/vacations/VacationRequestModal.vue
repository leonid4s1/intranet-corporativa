<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal-content">
      <h3 class="text-xl font-semibold mb-4">Solicitar Vacaciones</h3>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block font-medium mb-1">Fecha de inicio</label>
          <input type="date" v-model="form.startDate" class="input" required />
        </div>

        <div>
          <label class="block font-medium mb-1">Fecha de fin</label>
          <input type="date" v-model="form.endDate" class="input" required />
        </div>

        <div>
          <label class="block font-medium mb-1">Motivo (opcional)</label>
          <textarea v-model="form.reason" class="input" rows="2" />
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <button type="button" @click="close" class="btn-cancel">Cancelar</button>
          <button type="submit" class="btn-primary">Enviar</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  start: String
});
const emit = defineEmits(['submit', 'cancel']);

const form = ref({
  startDate: '',
  endDate: '',
  reason: ''
});

watch(() => props.start, (newStart) => {
  if (newStart) {
    form.value.startDate = newStart;
    form.value.endDate = newStart;
  }
}, { immediate: true });

const handleSubmit = () => {
  if (form.value.startDate > form.value.endDate) {
    alert('La fecha de inicio no puede ser despues de la fecha de fin');
    return;
  }
  emit('submit', { ...form.value });
};

const close = () => {
  emit('cancel');
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5); /* Fondo oscuro translúcido */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
}

.modal-content {
  background-color: white;
  padding: 2rem;
  border-radius: 1rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 0.375rem;
}

.btn-primary {
  background-color: #3B82F6;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}

.btn-cancel {
  background-color: #e5e7eb;
  color: black;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
}
</style>
