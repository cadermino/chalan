import axios from 'axios';

export default {
  createOrder(orderData) {
    return axios.post(`${process.env.VUE_APP_API_URL}order/create`, orderData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  getAddress(zipcode) {
    return axios.get(`${process.env.VUE_APP_API_URL}address/zipcode/${zipcode}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  getProducts(filters) {
    return axios.get(`${process.env.VUE_APP_API_URL}products`, {
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        from_floor: filters.from_floor,
        to_floor: filters.to_floor,
        from_state: filters.from_state,
        to_state: filters.to_state,
      },
    });
  },
  login(payload) {
    const data = { email: payload.email, password: payload.password };
    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data,
      url: `${process.env.VUE_APP_AUTH_API_URL}login`,
    };
    return axios(options);
  },
  loginFacebook(payload) {
    const data = { email: payload.email, name: payload.name, token: payload.token };
    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data,
      url: `${process.env.VUE_APP_AUTH_API_URL}login-facebook`,
    };
    return axios(options);
  },
  register(payload) {
    const data = {
      email: payload.email,
      password: payload.password,
      name: payload.name,
      mobile_phone: payload.mobilePhone,
    };
    const options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data,
      url: `${process.env.VUE_APP_AUTH_API_URL}register`,
    };
    return axios(options);
  },
  checkoutSession(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}order/checkout`, {
      headers: {
        Authorization: `Bearer ${payload.token}`,
        'Content-Type': 'application/json',
      },
      params: {
        customer_email: payload.email,
        client_reference_id: payload.customer_id,
        name: payload.name,
        description: payload.description,
        amount: payload.amount,
      },
    });
  },
};
