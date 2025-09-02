<template>
  <div v-if="password" class="password-strength-meter">
    <div class="strength-bars">
      <div
        v-for="i in 4"
        :key="i"
        class="strength-bar"
        :class="getBarClass(i)"
      ></div>
    </div>
    <div class="strength-text">
      Fortaleza: {{ strengthText }}
    </div>
  </div>
</template>

<script>
export default {
  name: "PasswordStrengthMeter",
  props: {
    password: {
      type: String,
      required: true
    }
  },
  computed: {
    strength() {
      if (!this.password) return 0

      // Lógica para calcular fortaleza (puedes mejorarla)
      let score = 0
      // Puntaje basado en criterios
      if (this.password.length >= 8) score++;
      if (this.password.length >= 12) score++;
      if (/[A-Z]/.test(this.password)) score++;
      if (/[0-9]/.test(this.password)) score++;
      if (/[^A-Za-z0-9]/.test(this.password)) score++;

      return Math.min(4, score); // Máximo 4 niveles
    },
    strengthText() {
      const levels = ["Muy debil", "Debil", "Moderada", "Fuerte", "Muy fuerte"];
      return levels[this.strength];
    }
  },
  methods: {
    getBarClass(index) {
      return {
        'active': index <= this.strength,
        'level-1': this.strength === 1,
        'level-2': this.strength === 2,
        'level-3': this.strength === 3,
        'level-4': this.strength >= 4
      };
    }
  }
}
</script>

<style scoped>
.password-strength-meter {
  margin-top: 8px;
}

.strength-bars {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
}

.strength-bar {
  height: 4px;
  flex-grow: 1;
  border-radius: 2px;
  background-color: #e0e0e0; /* Color base */
  transition: background-color 0.3s;
}

.strength-bar.active.level-1 {
  background-color: #ef4444; /* Rojo */
}

.strength-bar.active.level-2 {
  background-color: #f59e0b; /* Amarillo */
}

.strength-bar.active.level-3 {
  background-color: #3b82f6; /* Azul */
}

.strength-bar.active.level-4 {
  background-color: #10b981; /* Verde */
}

.strength-text {
  font-size: 0.75rem;
  color: #64748b; /* Gris */
  text-align: right;
}
</style>
