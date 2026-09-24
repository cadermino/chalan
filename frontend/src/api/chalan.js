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
    const headers = { 'Content-Type': 'application/json' };
    // El API ahora exige que quien edita una orden que ya tiene dueño sea ese
    // mismo cliente. Los primeros pasos del formulario siguen siendo anónimos
    // —la orden todavía no es de nadie—, así que la cabecera va solo cuando
    // hay sesión, en vez de exigirla siempre y romper a quien no se registró.
    const token = orderData.customer && orderData.customer.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return axios.put(`${process.env.VUE_APP_API_URL}order/${orderData.order.order_id}`, orderData, {
      headers,
    });
  },
  saveLeadPhone(payload) {
    return axios.put(`${process.env.VUE_APP_API_URL}order/${payload.orderId}/lead-phone`,
      { lead_phone: payload.leadPhone },
      {
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
  loginGoogle(payload) {
    return axios({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      data: { credential: payload.credential },
      url: `${process.env.VUE_APP_AUTH_API_URL}login-google`,
    });
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
  getOrderDetails(token) {
    return axios.get(`${process.env.VUE_APP_API_URL}orders/details`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  },
  createQuotation(payload) {
    return axios.post(`${process.env.VUE_APP_API_URL}quotations`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
    });
  },
  getOrdersByCarrierCompany(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}carrier-company/orders`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
    });
  },
  getOrderByCustomer(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}order/${payload.orderId}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
    });
  },
  getLastPendingOrder(payload) {
    return axios.get(`${process.env.VUE_APP_API_URL}customer/${payload.customerId}/last-pending-order`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${payload.token}`,
      },
    });
  },
  recognizeItems(payload) {
    const formData = new FormData();
    formData.append('image', payload.image);
    formData.append('order_id', payload.orderId);
    return axios.post(`${process.env.VUE_APP_API_URL}order/recognize-items`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
