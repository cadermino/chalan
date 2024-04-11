import Vue from 'vue';
import Vuex from 'vuex';
import VueJwtDecode from 'vue-jwt-decode';
import steps from './steps';

function checkCompleteStep(state) {
  const allStepsData = {
    ...state.currentOrder,
    ...state.orderDetailsOrigin,
    ...state.orderDetailsDestination,
    ...state.services,
  };
  Object.keys(state.steps).forEach((key) => {
    state.viewsMessages[key] = null;
    const requisitesValues = [];
    state.steps[key].requisites.forEach((requisite) => {
      requisitesValues.push(allStepsData[requisite]);
    });
    state.steps[key].isComplete = requisitesValues
      .reduce((prev, curr) => prev && Boolean(curr), true);
  });
}
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
    orderDetailsOrigin: {
      from_street: null,
      from_interior_number: null,
      from_floor_number: null,
      from_zip_code: null,
      from_country: null,
      from_map_url: null,
      from_approximate_distance_from_parking: null,
      from_has_elevator: null,
    },
    orderDetailsDestination: {
      to_street: null,
      to_interior_number: null,
      to_floor_number: null,
      to_zip_code: null,
      to_country: null,
      to_map_url: null,
      to_approximate_distance_from_parking: null,
      to_has_elevator: null,
    },
    services: {
      packaging: null,
      cargo: null,
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
      from_parking_distance: null,
      from_has_elevator: null,
      to_floor_number: null,
      to_street: null,
      to_neighborhood: null,
      to_zip_code: null,
      to_parking_distance: null,
      to_has_elevator: null,
      appointment_date: null,
      comments: null,
      packaging: null,
      cargo: null,
      quotation_amount: null,
      payment_method: null,
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
      state[payload.section][payload.field] = payload.value;
      localStorage.setItem(payload.section, JSON.stringify(state[payload.section]));
      state.formValidationMessages[payload.field] = null;
      checkCompleteStep(state);
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
        orderDetailsOrigin: 'setOrder',
        orderDetailsDestination: 'setOrder',
        services: 'setOrder',
        customer: 'setCustomerData',
      };
      if (localStorage.getItem(location)) {
        try {
          const data = JSON.parse(localStorage.getItem(location));
          Object.keys(data).forEach((key) => {
            commit(mutations[location], { section: location, field: key, value: data[key] });
          });
        } catch (e) {
          localStorage.removeItem(location);
          throw new Error(e);
        }
      }
    },
    validateRequiredFields({ commit, state }, viewName) {
      const emptyFields = [];
      const stepOneRequisites = {
        ...state.currentOrder,
        ...state.orderDetailsOrigin,
        ...state.orderDetailsDestination,
        ...state.services,
      };
      state.steps[viewName].requisites.forEach((field) => {
        if (!stepOneRequisites[field]) {
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
