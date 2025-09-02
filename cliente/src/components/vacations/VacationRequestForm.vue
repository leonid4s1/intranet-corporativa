<template>
    <div class="vacation-request-form p-4 bg-white rounded-xl shadow-xl max-w-md mx-auto mt-4">
      <h3 class="text-lg font-bold mb-4">Solicitar Vacaciones</h3>
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block font-medium mb-1">Fecha de inicio</label>
          <input type="date" v-model="form.startDate" class="input" required />
        </div>

        <div>
          <label class="block font-medium mb-1">Fecha de fin</label>
          <input type="date" v-model="form.endDate" class="input" required />
        </div>

        <div class="flex justify-end gap-2 mt-4">
          <button type="button" @click="$emit('cancel')" class="btn-cancel">Cancelar</button>
          <button type="submit" class="btn-primary">Enviar</button>
        </div>
      </form>
    </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  start: String // Fecha seleccionada en el calendario
});

const emit = defineEmits(['submit', 'cancel']);

const form = ref({
  startDate: '',
  endDate: '',
  reason: ''
});

// Al cargar el componente, si viene una fecha seleccionada, usarla como startDate y endDate
watch(() => props.start, (newStart) => {
  if (newStart) {
    form.value.startDate = newStart;
    form.value.endDate = newStart;
  }
}, { immediate: true });

const handleSubmit = () => {
  if (form.value.startDate > form.value.endDate) {
    alert('La fecha de inicio no puede ser posterior a la fecha de fin');
    return;
  }
  emit('submit', { ...form.value });
};
</script>

<style scoped>
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
