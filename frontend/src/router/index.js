import Vue from 'vue';
import VueRouter from 'vue-router';
import Home from '../views/Home.vue';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home,
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
    path: '/order/step-one',
    name: 'address',
    component: () => import(/* webpackChunkName: "step-one" */ '../views/order/Step-one.vue'),
  },
  {
    path: '/order/step-two',
    name: 'vehicle',
    component: () => import(/* webpackChunkName: "step-two" */ '../views/order/Step-two.vue'),
  },
  {
    path: '/order/step-three',
    name: 'confirmation',
    component: () => import(/* webpackChunkName: "step-three" */ '../views/order/Step-three.vue'),
  },
];

const router = new VueRouter({
  mode: 'history',
  base: process.env.VUE_APP_BASE_URL,
  routes,
});

export default router;
