import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import './assets/css/tailwind.css';

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
