import { createRouter, createWebHistory } from 'vue-router';
import steps from '../store/steps';
import { useStore } from '../store/index';
import pinia from '../store/pinia';
import countryData from '../countryData';
import storage from '../utils/safeStorage';

// Se pide en el primer guard, no al importar: main.js importa este archivo antes
// de app.use(pinia), y un store creado antes de eso nace sin los plugins
// (sessionTagsPlugin), así que la orden y el cliente nunca llegaban a Inspectlet
// ni a Clarity.
let store;
const country = import.meta.env.VUE_APP_COUNTRY;
const HTTP_RESPONSE = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
};
const RESPONSE_MESSAGE = {
  NOT_FOUND: {
    404: 'La orden no existe',
  },
};

const routes = [
  {
    path: '/',
    name: 'home',
    // La portada es el Next.js: se sale de la app. Router 4 pide un componente
    // aunque nunca se llegue a mostrar.
    component: { render: () => null },
    beforeEnter() {
      window.location = '/';
      return false;
    },
  },
  {
    path: '/carrier-company/orders/:token',
    name: 'ordersByCarrierCompany',
    component: () => import('../views/carrier-company/orders.vue'),
    props: route => ({
      token: route.params.token,
      countryData: countryData[country].general,
    }),
  },
  {
    path: '/carrier-company/order/:token',
    name: 'carrierCompanyOrderDetails',
    component: () => import('../views/carrier-company/order-details.vue'),
    props: route => ({
      token: route.params.token,
      countryData: countryData[country].general,
    }),
  },
  {
    path: '/carrier-company/:id',
    name: 'carrier-company',
    component: () => import('../views/carrier-company/index.vue'),
    props: route => ({
      carrierId: Number(route.params.id),
      countryData: countryData[country]['carrier-company'],
    }),
  },
  {
    path: '/order/step-one',
    name: 'step-one',
    component: () => import('../views/order/Step-one.vue'),
    props: {
      countryData: countryData[country]['step-one'],
    },
  },
  {
    path: '/order/step-two',
    name: 'step-two',
    component: () => import('../views/order/Step-two.vue'),
    meta: { requiresPreviousComplete: true },
  },
  {
    path: '/order/:order_id?/step-three',
    name: 'step-three',
    component: () => import('../views/order/Step-three.vue'),
    meta: { requiresPreviousComplete: true, requiresAuth: true },
    props: {
      countryData: countryData[country]['step-three'],
    },
  },
  {
    // Entre el paso 2 y el 3: nombre, correo y WhatsApp, sin contraseña.
    path: '/order/contacto',
    name: 'order-contact',
    component: () => import('../views/order/Contact.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true },
    props: {
      countryData: countryData[country].dashboard,
    },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/Login.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/auth/Register.vue'),
  },
  {
    path: '/register-login',
    redirect: '/login',
  },
  {
    // Link de los avisos de cotización: abre la orden sin pedir contraseña.
    path: '/acceso/:token',
    name: 'order-access',
    component: () => import('../views/OrderAccess.vue'),
    props: true,
  },
  {
    path: '/quotation/:token',
    name: 'quotation',
    component: () => import('../views/carrier-company/quotation.vue'),
    props: route => ({
      token: route.params.token,
      countryData: countryData[country].general,
    }),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'page-not-found',
    component: () => import('../views/PageNotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.VUE_APP_BASE_URL),
  routes,
  scrollBehavior() {
    return { top: 0, left: 0 };
  },
});

function hasQueryParams(route) {
  return !!Object.keys(route.query).length;
}

function getDataFromLocalStorage() {
  store.getDataFromLocalStorage('currentOrder');
  store.getDataFromLocalStorage('orderDetailsOrigin');
  store.getDataFromLocalStorage('orderDetailsDestination');
  store.getDataFromLocalStorage('services');
  store.getDataFromLocalStorage('customer');
  store.getDataFromLocalStorage('viewsMessages');
}

async function getOrderFromDataBase(to, next) {
  storage.removeItem('viewsMessages');
  if (to.params.order_id) {
    const { order_id: orderId } = to.params;
    try {
      await store.getOrderFromDataBase(orderId);
    } catch (error) {
      let message = '';
      if (error.response?.status === HTTP_RESPONSE.NOT_FOUND) {
        message = RESPONSE_MESSAGE.NOT_FOUND[error.response.status];
      }
      store.setViewsMessages({
        view: to.name,
        message: {
          text: message,
          type: 'error',
        },
      });
      store.addDataToLocalStorage(['viewsMessages']);
      if (error.response?.status === HTTP_RESPONSE.BAD_REQUEST) {
        next({
          path: '/register-login',
          query: { redirect: to.fullPath },
        });
        return true; // already navigated — caller must not call next() again
      }
    }
  }
  return false;
}

router.beforeEach(async (to, from, next) => {
  store = store || useStore(pinia);
  getDataFromLocalStorage();
  store.setNowDate();
  const alreadyNavigated = await getOrderFromDataBase(to, next);
  if (alreadyNavigated) return;

  let queryParams;
  if (!hasQueryParams(to) && hasQueryParams(from)) {
    queryParams = from.query;
  }

  if (to.matched.some(record => record.meta.requiresPreviousComplete
    && record.meta.requiresAuth)) {
    if (store.isUserLogged) {
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
      // Quien llega aquí (paso 2 -> paso 3) casi siempre es nuevo: el que
      // vuelve sigue con sesión en localStorage. Antes era un registro con
      // contraseña; ahora solo se piden los datos de contacto, y entrar con
      // una cuenta sigue a un clic desde esa misma pantalla.
      next({
        name: 'order-contact',
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
    if (store.isUserLogged) {
      if (!hasQueryParams(to) && hasQueryParams(from)) {
        next({ name: to.name, query: queryParams });
      } else {
        next();
      }
    } else {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
    }
  } else {
    next();
  }
});

// GA4's gtag.js only auto-sends a page_view on initial script load (see
// public/index.html, which disables that with send_page_view: false) - an
// SPA's later client-side navigations need a manual event per route change,
// or everything past the first page a visitor lands on goes untracked.
// window.gtag only exists in production (see index.html), so this is a
// no-op in local dev.
router.afterEach((to) => {
  if (typeof window.gtag !== 'function') return;

  // vue-router corre los hooks afterEach ANTES de hacer el pushState, así que
  // aquí el navegador todavía está en la URL anterior. Medido en producción:
  // el page_view salía con dl de la página vieja mientras el begin_order que
  // sale del mounted, unos ms después, ya traía la correcta.
  //
  // Encolar con nextTick no alcanza: es un microtask y corre dentro del mismo
  // turno, antes del pushState. Un setTimeout de 0 lo manda al siguiente
  // turno, cuando la URL y el título ya son los de destino.
  //
  // gtag ignora el page_location que se le pasa por evento y arma dl leyendo
  // document.location al momento del envío, así que la única forma de que
  // salga bien es enviar tarde, no pasarle el valor correcto.
  //
  // Eso se midió con vue-router 3. El 4 ya hizo el pushState al llegar acá,
  // pero el setTimeout no estorba y cubre los dos casos.
  setTimeout(() => {
    window.gtag('event', 'page_view', {
      page_path: to.fullPath,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, 0);
});

export default router;
