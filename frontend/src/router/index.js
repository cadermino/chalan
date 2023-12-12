import Vue from 'vue';
import VueRouter from 'vue-router';
import steps from '../store/steps';
import store from '../store/index';
import countryData from '../countryData';

const country = process.env.VUE_APP_COUNTRY;
Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'home',
    beforeEnter() {
      window.location = '/landing';
    },
  },
  {
    path: '/carrier-company/:id',
    name: 'carrier-company',
    component: () => import(/* webpackChunkName: "carrier-company" */ '../views/carrier-company'),
    props: route => ({
      carrierId: Number(route.params.id),
      countryData: countryData[country]['carrier-company'],
    }),
  },
  {
    path: '/order/step-one',
    name: 'step-one',
    component: () => import(/* webpackChunkName: "step-one" */ '../views/order/Step-one.vue'),
    props: {
      countryData: countryData[country]['step-one'],
    },
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
    props: {
      countryData: countryData[country]['step-three'],
    },
  },
  {
    path: '/order/step-four',
    name: 'step-four',
    component: () => import(/* webpackChunkName: "step-four" */ '../views/order/Step-four.vue'),
    meta: { requiresPreviousComplete: true, requiresAuth: true },
    props: {
      countryData: countryData[country]['step-four'],
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import(/* webpackChunkName: "dashboard" */ '../views/Dashboard.vue'),
    meta: { requiresAuth: true },
    props: route => ({
      sessionId: route.query.session_id,
      countryData: countryData[country].dashboard,
    }),
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

function hasQueryParams(route) {
  return !!Object.keys(route.query).length;
}

router.beforeEach((to, from, next) => {
  store.dispatch('getDataFromLocalStorage', 'currentOrder');
  store.dispatch('getDataFromLocalStorage', 'customer');
  store.commit('setNowDate');
  let queryParams;
  if (!hasQueryParams(to) && hasQueryParams(from)) {
    queryParams = from.query;
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
        if (!hasQueryParams(to) && hasQueryParams(from)) {
          next({ name: to.name, query: queryParams });
        } else {
          next();
        }
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
      if (!hasQueryParams(to) && hasQueryParams(from)) {
        next({ name: to.name, query: queryParams });
      } else {
        next();
      }
    }
  } else if (to.matched.some(record => record.meta.requiresAuth)) {
    if (store.getters.isUserLogged) {
      if (!hasQueryParams(to) && hasQueryParams(from)) {
        next({ name: to.name, query: queryParams });
      } else {
        next();
      }
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
