import Vue from 'vue';
import * as Sentry from '@sentry/vue';
import App from './App.vue';
import router from './router';
import store from './store';
import './assets/css/tailwind.css';

const moment = require('moment');

Vue.use(require('vue-moment'), {
  moment,
});

Vue.config.productionTip = false;

const sentryDsn = process.env.VUE_APP_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    Vue,
    dsn: sentryDsn,
    environment: 'production',
  });
}

new Vue({
  router,
  store,
  render: h => h(App),
}).$mount('#app');
