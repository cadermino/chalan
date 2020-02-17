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
    },
  },
  mutations: {
    assignOrder(state, order) {
      state.currentOrder = order;
    },
    setOrder(state, payload) {
      state.currentOrder[payload.field] = payload.value;
      state.formValidationMessages[payload.field] = null;
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
    verifyStepStatus(state) {
      const requisitesValues = [];
      Object.keys(state.steps).forEach((key) => {
        Object.keys(state.steps[key].requisites).forEach((requisite) => {
          requisitesValues.push(state.currentOrder[requisite]);
        });
        state.steps[key].isComplete = requisitesValues
          .reduce((prev, curr) => prev && Boolean(curr), true);
      });
    },
  },
  actions: {
    createOrder({ commit }) {
      chalan.createOrder()
        .then((response) => {
          commit('assignOrder', response.data);
        })
        .catch((error) => {
          console.log(error);
        });
    },
    getAddress({ commit }, payload) {
      chalan.getAddress(payload.zipcode)
        .then((response) => {
          if (response.data.length > 0) {
            const payloadNeighborhood = {
              value: response.data,
              direction: payload.direction,
            };
            commit('fillNeighborhoodList', payloadNeighborhood);
            const zipCodeResponse = {
              state: response.data[0].estado,
              city: response.data[0].municipio,
            };
            Object.keys(zipCodeResponse).forEach((key) => {
              const orderPayload = {
                field: `${payload.direction}_${key}`,
                value: zipCodeResponse[key],
              };
              commit('setOrder', orderPayload);
            });
          } else {
            commit('setFormValidationMessages', { field: `${payload.direction}_zip_code`, message: 'ingresa un código postal válido' });
          }
        })
        .catch((error) => {
          commit('setViewsMessages', { view: 'step-one', message: 'Hubo un error, intenta después de recargar la página' });
          console.log(error);
        });
    },
  },
});
