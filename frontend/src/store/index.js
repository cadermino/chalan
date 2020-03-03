import Vue from 'vue';
import Vuex from 'vuex';
import chalan from '../api/chalan';
import steps from './steps';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    steps,
    fromNeighborhoodList: [],
    toNeighborhoodList: [],
    currentOrder: {
      customer_id: null,
      driver_id: null,
      order_status_id: null,
      appointment_date: null,
      payment_id: null,
      comments: null,
      from_floor_number: null,
      from_street: null,
      from_interior_number: null,
      from_neighborhood: null,
      from_city: null,
      from_state: null,
      from_zip_code: null,
      to_floor_number: null,
      to_street: null,
      to_interior_number: null,
      to_neighborhood: null,
      to_city: null,
      to_state: null,
      to_zip_code: null,
    },
    viewsMessages: {
      'step-one': null,
      'step-two': null,
    },
    formValidationMessages: {
      from_floor_number: null,
      from_street: null,
      from_neighborhood: null,
      from_zip_code: null,
      to_floor_number: null,
      to_street: null,
      to_neighborhood: null,
      to_zip_code: null,
      appointment_date: null,
    },
  },
  mutations: {
    assignOrder(state, order) {
      state.currentOrder = order;
    },
    setOrder(state, payload) {
      state.currentOrder[payload.field] = payload.value;
      state.formValidationMessages[payload.field] = null;
      Object.keys(state.steps).forEach((key) => {
        const requisitesValues = [];
        state.steps[key].requisites.forEach((requisite) => {
          requisitesValues.push(state.currentOrder[requisite]);
        });
        state.steps[key].isComplete = requisitesValues
          .reduce((prev, curr) => prev && Boolean(curr), true);
      });
    },
    fillNeighborhoodList(state, payload) {
      state[`${payload.direction}NeighborhoodList`] = payload.value;
    },
    setViewsMessages(state, payload) {
      state.viewsMessages[payload.view] = payload.message;
    },
    setFormValidationMessages(state, payload) {
      state.formValidationMessages[payload.field] = payload.message;
    },
  },
  actions: {
    getDataFromLocalStorage({ commit }) {
      console.group("localStorage.getItem('currentOrder')", localStorage.getItem('currentOrder'));
      if (localStorage.getItem('currentOrder')) {
        try {
          const order = JSON.parse(localStorage.getItem('currentOrder'));
          Object.keys(order).forEach((key) => {
            commit('setOrder', { field: key, value: order[key] });
          });
        } catch (e) {
          localStorage.removeItem('currentOrder');
        }
      }
    },
    validateRequiredFields({ commit, state }, viewName) {
      const emptyFields = [];
      state.steps[viewName].requisites.forEach((field) => {
        if (!state.currentOrder[field]) {
          emptyFields.push(field);
        }
      });
      const message = (emptyFields.length > 0) ? 'Revisa que los campos requeridos * esten llenos.' : null;
      commit('setViewsMessages', { view: viewName, message });
      emptyFields.forEach((field) => {
        commit('setFormValidationMessages', { field, message: 'no olvides llenar este campo' });
      });
    },
    createOrder({ commit }) {
      chalan.createOrder()
        .then((response) => {
          commit('assignOrder', response.data);
        })
        .catch(() => {
        });
    },
  },
});
