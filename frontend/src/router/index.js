import Vue from 'vue';
import VueRouter from 'vue-router';
import steps from '../store/steps';
import store from '../store/index';
import countryData from '../countryData';

const country = process.env.VUE_APP_COUNTRY;
const HTTP_RESPONSE = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
};
const RESPONSE_MESSAGE = {
  NOT_FOUND: {
    404: 'La orden no existe',
  },
};
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
    path: '/carrier-company/orders/:token',
    name: 'ordersByCarrierCompany',
    component: () => import(/* webpackChunkName: "orders" */ '../views/carrier-company/orders'),
    props: route => ({
      token: route.params.token,
      countryData: countryData[country].general,
    }),
  },
  {
    path: '/carrier-company/order/:token',
    name: 'carrierCompanyOrderDetails',
    component: () => import(/* webpackChunkName: "order-details" */ '../views/carrier-company/order-details'),
    props: route => ({
      token: route.params.token,
      countryData: countryData[country].general,
    }),
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
    props: route => ({
      carrierId: Number(route.query['carrier-id']),
      countryData: countryData[country]['step-one'],
    }),
  },
  {
    path: '/order/step-two',
    name: 'step-two',
    component: () => import(/* webpackChunkName: "step-two" */ '../views/order/Step-two.vue'),
    meta: { requiresPreviousComplete: true },
  },
  {
    path: '/order/:order_id?/step-three',
    name: 'step-three',
    component: () => import(/* webpackChunkName: "step-three" */ '../views/order/Step-three.vue'),
    meta: { requiresPreviousComplete: true, requiresAuth: true },
    props: {
      countryData: countryData[country]['step-three'],
    },
  },
  {
    path: '/order/:order_id?/step-four',
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
    path: '/quotation/:token',
    name: 'quotation',
    component: () => import(/* webpackChunkName: "quotation" */ '../views/carrier-company/quotation'),
    props: route => ({
      token: route.params.token,
      countryData: countryData[country].general,
    }),
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

function getDataFromLocalStorage() {
  store.dispatch('getDataFromLocalStorage', 'currentOrder');
  store.dispatch('getDataFromLocalStorage', 'orderDetailsOrigin');
  store.dispatch('getDataFromLocalStorage', 'orderDetailsDestination');
  store.dispatch('getDataFromLocalStorage', 'services');
  store.dispatch('getDataFromLocalStorage', 'customer');
  store.dispatch('getDataFromLocalStorage', 'viewsMessages');
}

async function getOrderFromDataBase(to, next) {
  localStorage.removeItem('viewsMessages');
  if (to.params.order_id) {
    const { order_id: orderId } = to.params;
    try {
      await store.dispatch('getOrderFromDataBase', orderId);
    } catch (error) {
      let message = '';
      if (error.response?.status === HTTP_RESPONSE.NOT_FOUND) {
        message = RESPONSE_MESSAGE.NOT_FOUND[error.response.status];
      }
      store.commit('setViewsMessages', {
        view: to.name,
        message: {
          text: message,
          type: 'error',
        },
      });
      store.dispatch('addDataToLocalStorage', ['viewsMessages']);
      if (error.response?.status === HTTP_RESPONSE.BAD_REQUEST) {
        next({
          path: '/register-login',
          query: { redirect: to.fullPath },
        });
      }
    }
  }
}

router.beforeEach(async (to, from, next) => {
  getDataFromLocalStorage();
  store.commit('setNowDate');
  getOrderFromDataBase(to, next);

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
          params: to.params,
        });
      } else if (steps[steps[to.name].previous].isComplete) {
        if (!hasQueryParams(to) && hasQueryParams(from)) {
          next({
            name: to.name,
            query: queryParams,
            params: to.params,
          });
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
        params: to.params,
      });
    } else if (steps[steps[to.name].previous].isComplete) {
      if (!hasQueryParams(to) && hasQueryParams(from)) {
        next({
          name: to.name,
          query: queryParams,
          params: to.params,
        });
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
