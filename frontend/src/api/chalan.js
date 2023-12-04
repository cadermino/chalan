import axios from 'axios';

export default {
  createOrder(orderData) {
    return axios.post(`${process.env.VUE_APP_API_URL}order`, orderData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
  updateOrder(orderData) {
    return axios.put(`${process.env.VUE_APP_API_URL}order/${orderData.order.order_id}`, orderData, {
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
  getQuotations(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}quotations/${payload.orderId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
    });
  },
  updateQuotation(payload) {
    return axios.put(`${process.env.VUE_APP_API_URL}quotation/${payload.quotationId}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
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
    const data = {
      email: payload.email,
      name: payload.name,
      token: payload.token,
      mobile_phone: payload.mobilePhone,
    };
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
    return axios.put(`${process.env.VUE_APP_API_URL}order/checkout/${payload.orderId}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.token}`,
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
  checkoutCash(payload) {
    return axios.put(`${process.env.VUE_APP_API_URL}order/checkout-cash/${payload.orderId}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.token}`,
        },
      });
  },
  confirmStripePayment(payload) {
    return axios.put(`${process.env.VUE_APP_API_URL}order/confirm-stripe-payment/${payload.orderId}`,
      {
        session_id: payload.sessionId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.token}`,
        },
      });
  },
  updateCustomerProfile(payload) {
    return axios.patch(`${process.env.VUE_APP_API_URL}customer/${payload.customerId}`,
      {
        mobile_phone: payload.mobilePhone,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.token}`,
        },
      });
  },
  getPendingOrders(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}customer/${payload.customerId}/orders`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
    });
  },
  getCarrierCompany(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}carrier-company/${payload.carrierId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  },
};
