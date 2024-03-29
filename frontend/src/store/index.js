import Vue from 'vue';
import Vuex from 'vuex';
import VueJwtDecode from 'vue-jwt-decode';
import steps from './steps';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    FB: undefined,
    nowDate: '',
    steps,
    customer: {
      email: null,
      customer_id: null,
      customer_name: null,
      mobile_phone: null,
      token: null,
      picture: null,
    },
    currentOrder: {
      created_date: null,
      order_id: null,
      order_status_id: null,
      quotation_id: null,
      country_id: null,
      from_street: null,
      from_interior_number: null,
      from_floor_number: null,
      from_zip_code: null,
      from_country: null,
      from_map_url: null,
      to_street: null,
      to_interior_number: null,
      to_floor_number: null,
      to_zip_code: null,
      to_country: null,
      to_map_url: null,
      appointment_date: null,
      comments: null,
      payment_method: null,
      amount: null,
      carrier_company_id: null,
      vehicle_picture: null,
      vehicle_brand: null,
      vehicle_model: null,
      vehicle_weight: null,
      vehicle_description: null,
    },
    viewsMessages: {
      'step-one': null,
      'step-two': null,
      'step-three': null,
      'step-four': null,
      'register-login': null,
      'carrier-company': null,
      dashboard: null,
      quotation: null,
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
      payment_method: null,
      quotation_amount: null,
    },
    loading: false,
  },
  getters: {
    getToken(state) {
      return state.customer.token;
    },
    isTokenValid(state, getters) {
      return state.nowDate < (getters.decodeToken.exp * 1000);
    },
    decodeToken(state) {
      try {
        return VueJwtDecode.decode(state.customer.token);
      } catch {
        return {
          exp: 0,
        };
      }
    },
    isUserLogged: (state, getters) => (state.customer.customer_id
      && state.customer.token
      && getters.isTokenValid) || false,
    getFirstIncompleteStep(state) {
      let lastStep = {};
      Object.keys(state.steps).every((viewName) => {
        if (!state.steps[viewName].isComplete) {
          lastStep = state.steps[viewName];
          lastStep.viewName = viewName;
          return false;
        }
        return true;
      });
      return lastStep;
    },
  },
  mutations: {
    setFB(state, FB) {
      state.FB = FB;
    },
    setOrder(state, payload) {
      state.currentOrder[payload.field] = payload.value;
      localStorage.setItem('currentOrder', JSON.stringify(state.currentOrder));
      state.formValidationMessages[payload.field] = null;
      Object.keys(state.steps).forEach((key) => {
        state.viewsMessages[key] = null;
        const requisitesValues = [];
        state.steps[key].requisites.forEach((requisite) => {
          requisitesValues.push(state.currentOrder[requisite]);
        });
        state.steps[key].isComplete = requisitesValues
          .reduce((prev, curr) => prev && Boolean(curr), true);
      });
    },
    setCustomerData(state, payload) {
      state.customer[payload.field] = payload.value;
      localStorage.setItem('customer', JSON.stringify(state.customer));
    },
    setViewsMessages(state, payload) {
      state.viewsMessages[payload.view] = payload.message;
    },
    setFormValidationMessages(state, payload) {
      state.formValidationMessages[payload.field] = payload.message;
    },
    setNowDate(state) {
      state.nowDate = Date.now();
    },
    setLoader(state, value) {
      state.loading = value;
    },
  },
  actions: {
    logout({ state, dispatch, commit }) {
      if (state.FB) {
        state.FB.logout();
      }
      commit('setCustomerData', { field: 'customer_id', value: null });
      commit('setCustomerData', { field: 'token', value: null });
      dispatch('addDataToLocalStorage', ['customer']);
      window.location.reload();
    },
    addDataToLocalStorage({ state }, location) {
      location.forEach((item) => {
        localStorage.setItem(item, JSON.stringify(state[item]));
      });
    },
    getDataFromLocalStorage({ commit }, location) {
      const mutations = {
        currentOrder: 'setOrder',
        customer: 'setCustomerData',
      };
      if (localStorage.getItem(location)) {
        try {
          const data = JSON.parse(localStorage.getItem(location));
          Object.keys(data).forEach((key) => {
            commit(mutations[location], { field: key, value: data[key] });
          });
        } catch (e) {
          localStorage.removeItem(location);
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
      let message = {};
      if (emptyFields.length > 0 && viewName === 'step-three') {
        message = {
          type: 'error',
          text: 'Por favor elige una cotización',
        };
      } else if (emptyFields.length > 0) {
        message = {
          type: 'error',
          text: 'Revisa que los campos requeridos * esten llenos.',
        };
      } else {
        message = null;
      }
      commit('setViewsMessages', { view: viewName, message });
      emptyFields.forEach((field) => {
        commit('setFormValidationMessages', { field, message: 'no olvides llenar este campo' });
      });
    },
  },
});
