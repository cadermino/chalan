import Vue from 'vue';
import Vuex from 'vuex';
import VueJwtDecode from 'vue-jwt-decode';
import steps from './steps';
import chalan from '../api/chalan';

const isEmpty = arr => !arr.length;

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
      is_tenant: null,
      created_date: null,
      order_id: null,
      order_status_id: null,
      country_id: null,
      appointment_date: null,
      comments: null,
      approximate_budget: null,
      quotation_id: null,
      amount: null,
      carrier_company_id: null,
      vehicle_picture: null,
      vehicle_brand: null,
      vehicle_model: null,
      vehicle_weight: null,
      vehicle_description: null,
      payment_method: null,
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
    async getOrderFromDataBase({ commit, state }, orderId) {
      const payload = {
        token: state.customer.token,
        orderId,
      };
      const order = await chalan.getOrderByCustomer(payload)
        .catch(err => Promise.reject(err));
      const currentOrder = {};
      ({
        amount: currentOrder.amount,
        appointment_date: currentOrder.appointment_date,
        approximate_budget: currentOrder.approximate_budget,
        comments: currentOrder.comments,
        created_date: currentOrder.created_date,
        lu_order_status: currentOrder.order_status_id,
        id: currentOrder.order_id,
        selected_quotation_id: currentOrder.quotation_id,
        vehicle: { brand: currentOrder.vehicle_brand } = {},
        vehicle: { model: currentOrder.vehicle_model } = {},
        vehicle: { picture: currentOrder.vehicle_picture } = {},
        vehicle: { weight: currentOrder.vehicle_weight } = {},
        vehicle: { description: currentOrder.vehicle_description } = {},
      } = order.data.order);
      Object.keys(currentOrder).forEach((key) => {
        commit('setOrder', { section: 'currentOrder', field: key, value: currentOrder[key] });
      });
      const {
        order_details: orderDetails,
        services,
      } = order.data.order;
      const orderDetailsOrigin = orderDetails.filter(item => item.type === 'carry_from')[0];
      const from = {};
      ({
        street: from.from_street,
        interior_number: from.from_interior_number,
        floor_number: from.from_floor_number,
        zip_code: from.from_zip_code,
        country: from.from_country,
        map_url: from.from_map_url,
        approximate_distance_from_parking: from.from_approximate_distance_from_parking,
        has_elevator: from.from_has_elevator,
      } = orderDetailsOrigin);
      from.from_has_elevator = String(from.from_has_elevator);
      Object.keys(from).forEach((key) => {
        commit('setOrder', { section: 'orderDetailsOrigin', field: key, value: from[key] });
      });
      const orderDetailsDestination = orderDetails.filter(item => item.type === 'deliver_to')[0];
      const to = {};
      ({
        street: to.to_street,
        interior_number: to.to_interior_number,
        floor_number: to.to_floor_number,
        zip_code: to.to_zip_code,
        country: to.to_country,
        map_url: to.to_map_url,
        approximate_distance_from_parking: to.to_approximate_distance_from_parking,
        has_elevator: to.to_has_elevator,
      } = orderDetailsDestination);
      from.to_has_elevator = String(to.to_has_elevator);
      Object.keys(to).forEach((key) => {
        commit('setOrder', { section: 'orderDetailsDestination', field: key, value: to[key] });
      });
      let packaging = null;
      let cargo = null;
      if (!isEmpty(services)) {
        packaging = services.find(item => item.name === 'packaging');
        cargo = services.find(item => item.name === 'cargo');
      }
      commit('setOrder', { section: 'services', field: 'packaging', value: packaging ? '1' : '0' });
      commit('setOrder', { section: 'services', field: 'cargo', value: cargo ? '1' : '0' });
      return true;
    },
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
        viewsMessages: 'setViewsMessages',
      };
      if (localStorage.getItem(location)) {
        try {
          const data = JSON.parse(localStorage.getItem(location));
          Object.keys(data).forEach((key) => {
            commit(mutations[location], { section: location, field: key, value: data[key] });
            if (location === 'viewsMessages') {
              commit(mutations[location], { section: location, view: key, message: data[key] });
            }
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
