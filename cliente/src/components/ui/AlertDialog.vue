<template>
  <div class="alert-dialog-overlay" v-if="visible">
    <div class="alert-dialog" :class="type">
      <div class="alert-icon">
        <i :class="iconClass"></i>
      </div>
      <div class="alert-content">
        <h3 class="alert-title">{{ title }}</h3>
        <p class="alert-message">{{ message }}</p>
      </div>
      <button class="alert-close" @click="close">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['info', 'success', 'warning', 'error'].includes(value)
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true
  },
  duration: {
    type: Number,
    default: 5000 // Duración en milisegundos
  }
});

const emit = defineEmits(['close']);

const visible = ref(true);

// Cierre automático después de la duración especificada
if (props.duration > 0) {
  setTimeout(() => {
    close();
  }, props.duration);
}

const iconClass = computed(() => {
  switch (props.type) {
    case 'success': return 'fas fa-check-circle';
    case 'warning': return 'fas fa-exclamation-triangle';
    case 'error': return 'fas fa-times-circle';
    default: return 'fas fa-info-circle';
  }
});

const defaultTitles = {
  info: 'Información',
  success: 'Éxito',
  warning: 'Advertencia',
  error: 'Error'
};

const title = computed(() => props.title || defaultTitles[props.type]);

function close() {
  visible.value = false;
  emit('close');
}
</script>

<style scoped>
.alert-dialog-overlay {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2000;
  animation: slideIn 0.3s ease-out forwards;
}

.alert-dialog {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  max-width: 400px;
  position: relative;
  overflow: hidden;
}

.alert-dialog::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.alert-dialog.info {
  background-color: #e7f5ff;
  color: #1864ab;
}

.alert-dialog.info::before {
  background-color: #1971c2;
}

.alert-dialog.success {
  background-color: #ebfbee;
  color: #2b8a3e;
}

.alert-dialog.success::before {
  background-color: #2b8a3e;
}

.alert-dialog.warning {
  background-color: #fff9db;
  color: #e67700;
}

.alert-dialog.warning::before {
  background-color: #f59f00;
}

.alert-dialog.error {
  background-color: #fff5f5;
  color: #c92a2a;
}

.alert-dialog.error::before {
  background-color: #fa5252;
}

.alert-icon {
  font-size: 1.5rem;
  margin-right: 12px;
  flex-shrink: 0;
}

.alert-content {
  flex-grow: 1;
}

.alert-title {
  margin: 0 0 4px 0;
  font-weight: 600;
  font-size: 1rem;
}

.alert-message {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
}

.alert-close {
  background: none;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  margin-left: 12px;
  padding: 0;
  font-size: 1rem;
  transition: opacity 0.2s;
}

.alert-close:hover {
  opacity: 1;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

/* Para animación de salida cuando se cierra */
.alert-dialog-overlay.leaving {
  animation: slideOut 0.3s ease-in forwards;
}

/* Responsive */
@media (max-width: 480px) {
  .alert-dialog-overlay {
    left: 20px;
    right: 20px;
    top: 20px;
  }

  .alert-dialog {
    min-width: auto;
    width: 100%;
  }
}
</style>
