import { createApp } from 'vue';
import * as Sentry from '@sentry/vue';
import moment from 'moment';
// Con webpack, moment.locale('es') cargaba el idioma solo; con Vite hay que
// importarlo, o las fechas que se muestran salen en inglés.
import 'moment/locale/es';
import App from './App.vue';
import router from './router';
import pinia from './store/pinia';
import './assets/css/tailwind.css';

const app = createApp(App);

// Lo que antes daba vue-moment: los componentes usan this.$moment.
app.config.globalProperties.$moment = moment;

const sentryDsn = import.meta.env.VUE_APP_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    environment: 'production',
  });
}

// Pinia antes que el router: sus guards leen el store en la primera navegación.
app.use(pinia);
app.use(router);
app.mount('#app');
