import Vue from 'vue';
import VueRouter from 'vue-router';
// import Home from '../views/Home.vue';
import steps from '../store/steps';
import store from '../store/index';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'home',
    // component: Home,
    beforeEnter() {
      // Put the full page url including the protocol http(s) below
      window.location = 'https://dev.chalan.mx/landing/';
    },
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue'),
  },
  {
    path: '/politica-de-privacidad',
    name: 'privacy',
    component: () => import(/* webpackChunkName: "privacy" */ '../views/Privacy.vue'),
  },
  {
    path: '/order/step-one',
    name: 'step-one',
    component: () => import(/* webpackChunkName: "step-one" */ '../views/order/Step-one.vue'),
  },
  {
    path: '/order/step-two',
    name: 'step-two',
    component: () => import(/* webpackChunkName: "step-two" */ '../views/order/Step-two.vue'),
    meta: { requiresPreviousComplete: true },
  },
  {
    path: '/order/step-three',
    name: 'step-three',
    component: () => import(/* webpackChunkName: "step-three" */ '../views/order/Step-three.vue'),
    meta: { requiresPreviousComplete: true, requiresAuth: true },
  },
  {
    path: '/order/step-four',
    name: 'step-four',
    component: () => import(/* webpackChunkName: "step-four" */ '../views/order/Step-four.vue'),
    meta: { requiresPreviousComplete: true, requiresAuth: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '../views/Dashboard.vue'),
    meta: { requiresAuth: true },
    props: route => ({ sessionId: route.query.session_id }),
  },
  {
    path: '/register-login',
    name: 'register-login',
    component: () => import(/* webpackChunkName: "register-login" */ '../views/RegisterLogin.vue'),
  },
  {
    path: '*',
    name: 'page-not-found',
    component: () => import(/* webpackChunkName: "page-not-found" */ '../views/PageNotFound.vue'),
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.VUE_APP_BASE_URL,
  routes,
  scrollBehavior() {
    return { x: 0, y: 0 };
  },
});

router.beforeEach((to, from, next) => {
  store.dispatch('getDataFromLocalStorage', 'currentOrder');
  store.dispatch('getDataFromLocalStorage', 'customer');
  store.commit('setNowDate');
  if (store.getters.getToken && !store.getters.isTokenValid) {
    localStorage.removeItem('currentOrder');
    localStorage.removeItem('customer');
    window.location.reload();
  }
  if (to.matched.some(record => record.meta.requiresPreviousComplete
    && record.meta.requiresAuth)) {
    if (store.getters.isUserLogged) {
      if (!steps[to.name].previous) {
        next({
          name: 'step-one',
        });
      } else if (!steps[steps[to.name].previous].isComplete) {
        next({
          name: steps[to.name].previous,
        });
      } else if (steps[steps[to.name].previous].isComplete) {
        next();
      }
    } else {
      next({
        path: '/register-login',
        query: { redirect: to.fullPath },
      });
    }
  } else if (to.matched.some(record => record.meta.requiresPreviousComplete)) {
    if (!steps[to.name].previous) {
      next({
        name: 'step-one',
      });
    } else if (!steps[steps[to.name].previous].isComplete) {
      next({
        name: steps[to.name].previous,
      });
    } else if (steps[steps[to.name].previous].isComplete) {
      next();
    }
  } else if (to.matched.some(record => record.meta.requiresAuth)) {
    if (store.getters.isUserLogged) {
      next();
    } else {
      next({
        path: '/register-login',
        query: { redirect: to.fullPath },
      });
    }
  } else {
    next();
  }
});
export default router;
