<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { getApprovedAdmin, type UserStatusFilter, type AdminApprovedRow } from '@/services/vacation.service';

const loading = ref(false);
const errorMsg = ref('');
const rows = ref<AdminApprovedRow[]>([]);

// Filtros
const q = ref('');
const from = ref('');
const to = ref('');
const userStatus = ref<UserStatusFilter | ''>('');

async function fetchData() {
  loading.value = true;
  errorMsg.value = '';
  try {
    rows.value = await getApprovedAdmin({
      q: q.value || undefined,
      from: from.value || undefined,
      to: to.value || undefined,
      userStatus: (userStatus.value || undefined) as UserStatusFilter | undefined,
    });
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } }; message?: string };
    errorMsg.value = err?.response?.data?.error ?? err?.message ?? 'Error cargando datos';
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  q.value = ''; from.value = ''; to.value = ''; userStatus.value = '';
  fetchData();
}

function exportCSV() {
  const header = ['Nombre','Email','EstadoUsuario','Inicio','Fin','Dias','Creado'].join(',');
  const csv = rows.value.map(r => [
    `"${r.displayName.replace(/"/g, '""')}"`,
    `"${(r.displayEmail ?? '').replace(/"/g, '""')}"`,
    r.userStatus, r.startDate, r.endDate, r.totalDays, r.createdAt ?? ''
  ].join(','));
  const blob = new Blob([header + '\n' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `vacaciones_aprobadas_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const total = computed(() => rows.value.length);
onMounted(fetchData);
</script>

<template>
  <div class="p-4 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Vacaciones aprobadas (Admin)</h1>
      <div class="flex gap-2">
        <button @click="exportCSV" class="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">Exportar CSV</button>
        <button @click="fetchData" class="px-3 py-2 rounded bg-gray-900 text-white hover:bg-black">Refrescar</button>
      </div>
    </div>

    <div class="grid md:grid-cols-5 gap-3 bg-white p-3 rounded border">
      <input v-model="q" placeholder="Buscar nombre o email" class="border p-2 rounded w-full" />
      <input v-model="from" type="date" class="border p-2 rounded w-full" />
      <input v-model="to" type="date" class="border p-2 rounded w-full" />
      <select v-model="userStatus" class="border p-2 rounded w-full">
        <option value="">Estado usuario (todos)</option>
        <option value="Activo">Activo</option>
        <option value="Inactivo">Inactivo</option>
        <option value="Eliminado">Eliminado</option>
      </select>
      <div class="flex gap-2">
        <button @click="fetchData" class="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Aplicar</button>
        <button @click="resetFilters" class="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">Limpiar</button>
      </div>
    </div>

    <p v-if="errorMsg" class="text-red-600">{{ errorMsg }}</p>
    <p v-else class="text-sm text-gray-500">Resultados: {{ total }}</p>

    <div class="overflow-auto rounded border bg-white">
      <table class="min-w-full text-sm">
        <thead class="bg-gray-50 text-gray-600">
          <tr>
            <th class="text-left p-2">Nombre</th>
            <th class="text-left p-2">Email</th>
            <th class="text-left p-2">Estado</th>
            <th class="text-left p-2">Inicio</th>
            <th class="text-left p-2">Fin</th>
            <th class="text-left p-2">Días</th>
            <th class="text-left p-2">Creado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="p-4">Cargando...</td>
          </tr>
          <tr v-for="r in rows" :key="r.id" class="border-t">
            <td class="p-2 font-medium">{{ r.displayName }}</td>
            <td class="p-2">{{ r.displayEmail || '—' }}</td>
            <td class="p-2">
              <span :class="[
                'px-2 py-1 rounded text-xs',
                r.userStatus==='Activo' ? 'bg-green-100 text-green-800' :
                r.userStatus==='Inactivo' ? 'bg-gray-200 text-gray-800' :
                'bg-red-100 text-red-800'
              ]">
                {{ r.userStatus }}
              </span>
            </td>
            <td class="p-2">{{ r.startDate }}</td>
            <td class="p-2">{{ r.endDate }}</td>
            <td class="p-2">{{ r.totalDays }}</td>
            <td class="p-2">{{ r.createdAt?.slice(0,10) || '—' }}</td>
          </tr>
          <tr v-if="!loading && !rows.length">
            <td colspan="7" class="p-4 text-gray-500">No hay resultados.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
