// src/main.ts
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

import dayjs from 'dayjs';
import 'dayjs/locale/es';

// ⬇️ Plugins que ya tenías
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// ⬇️ Plugins necesarios para las comparaciones usadas en el calendario
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isBetween from 'dayjs/plugin/isBetween'; // si chequeas rangos con 'isBetween'

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);
dayjs.locale('es');

// (Opcional) fija una zona horaria por defecto si tu backend/UX lo requiere
// dayjs.tz.setDefault('America/Mexico_City');

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
