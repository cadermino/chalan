import Vue from 'vue';
import VueGtm from 'vue-gtm';
import App from './App.vue';
import router from './router';
import store from './store';
import './assets/css/tailwind.css';


Vue.use(VueGtm, {
  id: 'GTM-M42XW7C',
  // queryParams: {
  //   gtm_auth: 'AB7cDEf3GHIjkl-MnOP8qr',
  //   gtm_preview: 'env-4',
  //   gtm_cookies_win: 'x',
  // },
  defer: false,
  enabled: true,
  debug: true,
  loadScript: true,
  vueRouter: router,
  ignoredViews: ['homepage'],
});

const moment = require('moment');

Vue.use(require('vue-moment'), {
  moment,
});

Vue.config.productionTip = false;

new Vue({
  router,
  store,
  render: h => h(App),
}).$mount('#app');
