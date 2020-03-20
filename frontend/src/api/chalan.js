import axios from 'axios';

const orderData = {
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
};

export default {
  createOrder() {
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
  getAvailableVehicles() {
    return axios.get(`${process.env.VUE_APP_API_URL}vehicle/available`, {
      headers: {
        'Content-Type': 'application/json',
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
};
