<template>
  <div class="flex flex-wrap my-10">
    <div class="w-full max-w-xl mx-auto text-center p-5">
      <p class="text-gray-700">Abriendo tus cotizaciones...</p>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters, mapMutations } from 'vuex';
import chalan from '../api/chalan';
import { track } from '../utils/analytics';

// Link del aviso de "nueva cotización" (y del backoffice): /acceso/<token>.
// Canjea el token por una sesión, como un login, y abre las cotizaciones de esa
// orden. Si había otra sesión en este navegador, la reemplaza: el link manda.
const MESSAGES = {
  expired: 'Este link ya venció. Entra con tu correo, o escríbenos por WhatsApp y te mandamos uno nuevo.',
  invalid: 'Este link no es válido. Entra con tu correo, o escríbenos por WhatsApp y te mandamos uno nuevo.',
};

export default {
  name: 'order-access',
  props: {
    token: { type: String, required: true },
  },
  computed: {
    ...mapGetters(['decodeToken']),
  },
  async mounted() {
    try {
      const { data } = await chalan.orderAccess({ token: this.token });
      this.setCustomerData({ field: 'token', value: data.token });
      this.setCustomerData({ field: 'customer_id', value: this.decodeToken.id });
      this.setCustomerData({ field: 'email', value: data.email });
      this.setCustomerData({ field: 'mobile_phone', value: data.mobile_phone });
      this.setCustomerData({ field: 'customer_name', value: data.name });
      this.setCustomerData({ field: 'picture', value: '' });
      // Entrar por el link cuenta como login en el embudo de GA4. Sin esto,
      // quien dejó un correo que ya tenía cuenta en el paso de contacto
      // (contact_existing_account) quedaba como fuga aunque sí entrara.
      track('login', { method: 'order_link', order_id: data.order_id });
      this.$router.replace({ name: 'step-three', params: { order_id: data.order_id } }).catch(() => {});
    } catch (error) {
      const reason = error.response?.data?.reason;
      this.setViewsMessages({
        view: 'register-login',
        message: { text: MESSAGES[reason] || MESSAGES.invalid, type: 'error' },
      });
      this.addDataToLocalStorage(['viewsMessages']);
      this.$router.replace({ name: 'login' }).catch(() => {});
    }
  },
  methods: {
    ...mapMutations(['setCustomerData', 'setViewsMessages']),
    ...mapActions(['addDataToLocalStorage']),
  },
};
</script>
