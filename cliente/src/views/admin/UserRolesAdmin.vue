<template>
  <div class="roles-admin">
    <h2>Asignar Roles y Funciones</h2>

    <div class="user-selection">
      <label>Seleccionar Usuario:</label>
      <select v-model="selectedUser">
        <option v-for="user in users" :key="user.id" :value="user.id">
          {{ user.name }} ({{ user.email }})
        </option>
      </select>
    </div>

    <div class="role-assignment" v-if="selectedUser">
      <h3>Informacion de Puesto</h3>

      <div class="form-group">
        <label>Titulo del Puesto:</label>
        <input v-model="roleData.title" type="text">
      </div>

      <div class="form-group">
        <label>Reporta a:</label>
        <input v-model="roleData.reportsTo" type="text">
      </div>

      <div class="form-group">
        <labe>Descripcion:</labe>
        <textarea v-model="roleData.description"></textarea>
      </div>

      <div class="form-group">
        <label>Funciones Principales (una por linea):</label>
        <textarea v-model="roleFunctions"></textarea>
      </div>

      <button @click="saveRoleInfo">Guardar Informacion</button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: [],
      selectedUser: null,
      roleData: {
        title: '',
        reportsTo: '',
        description: '',
        functions: []
      },
      roleFunctions: ''
    }
  },
  async created() {
    // Carga lista de usuarios
    this.users = await this.$api.getUsers();
  },
  methods: {
    async saveRoleInfo() {
      // Convertir texto de funciones a array
      this.roleData.functions = this.roleFunctions.split('\n').filter(f => f.trim());

      // Guardar en backend
      await this.$api.updateUserRole(this.selectedUser, this.roleData);

      alert('Informacion de puesto guardada correctamente');
    }
  }
}
</script>

<style scoped>
.roles-admin {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
.from-group {
  margin-bottom: 15px;
}
label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
input, textarea, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
button {
  background-color: #4CAF50;
  color: white;
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
