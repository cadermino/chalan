<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="xl:w-1/4 max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>

          <div v-if="linkSentTo" class="bg-white pb-8 sm:p-0 p-5 sm:pb-8 text-gray-700">
            <p class="text-center font-bold mb-6">Revisa tu correo</p>
            <p class="mb-4">
              <strong>{{ linkSentTo }}</strong> ya tiene una cuenta en Chalán, así que te
              mandamos ahí un link para confirmar tu pedido.
            </p>
            <p class="mb-6">
              Al abrirlo se lo enviamos a los transportistas y ves las cotizaciones cuando
              lleguen. No necesitas contraseña.
            </p>
            <p class="text-sm">
              ¿Prefieres entrar con tu contraseña o con Google?
              <span @click="goToLogin"
                class="font-bold cursor-pointer text-blue-700">Inicia sesión.</span>
            </p>
          </div>

          <form v-else class="bg-white pb-8 sm:p-0 p-5 sm:pb-8" @submit.prevent="submit">
            <p class="text-center font-bold mb-2">¿A dónde te avisamos?</p>
            <p class="text-center text-sm text-gray-600 mb-8">
              Sin contraseña. Te avisamos por WhatsApp y por correo cuando lleguen las
              cotizaciones.
            </p>
            <div class="flex flex-wrap -mx-3">
              <div class="w-full px-3 mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="name">
                  Nombre <span class="text-red-500">*</span>
                </label>
                <input :class="errors.name ? 'border-red-300' : ''"
                  class="appearance-none border rounded w-full py-2 px-3 text-gray-700
                  leading-tight focus:outline-none focus:border-blue-400"
                  v-model.trim="fields.name" id="name" type="text"
                  autocomplete="name" placeholder="Juan Pedro">
                <p v-if="errors.name" class="text-red-500 text-xs italic">{{ errors.name }}.</p>
              </div>
              <div class="w-full px-3 mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="email">
                  Correo electrónico <span class="text-red-500">*</span>
                </label>
                <input :class="errors.email ? 'border-red-300' : ''"
                  class="appearance-none border rounded w-full py-2 px-3 text-gray-700
                  leading-tight focus:outline-none focus:border-blue-400"
                  v-model.trim="fields.email" id="email" type="email"
                  autocomplete="email" placeholder="juan.pedro@email.com">
                <p v-if="errors.email" class="text-red-500 text-xs italic">{{ errors.email }}.</p>
                <p v-else-if="emailSuggestion" class="text-xs text-gray-600 mt-1">
                  ¿Quisiste decir
                  <span @click="fields.email = emailSuggestion"
                    class="font-bold cursor-pointer text-blue-700">{{ emailSuggestion }}</span>?
                </p>
              </div>
              <div class="w-full px-3 mb-4">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="mobilePhone">
                  WhatsApp <span class="text-red-500">*</span>
                </label>
                <input :class="errors.mobilePhone ? 'border-red-300' : ''"
                  class="appearance-none border rounded w-full py-2 px-3 text-gray-700
                  leading-tight focus:outline-none focus:border-blue-400"
                  v-model.trim="fields.mobilePhone" id="mobilePhone" type="tel"
                  autocomplete="tel" placeholder="Ej. 987654321">
                <p v-if="errors.mobilePhone" class="text-red-500 text-xs italic">
                  {{ errors.mobilePhone }}.
                </p>
              </div>
              <div class="w-full px-3 mb-4">
                <button type="submit" :disabled="loading"
                  :class="loading ? 'opacity-50 cursor-not-allowed' : ''"
                  class="w-full bg-green-500 hover:bg-green-700 text-white py-2 px-4
                  rounded focus:outline-none">
                  Ver mis cotizaciones
                </button>
                <p class="text-sm text-left mt-4">
                  ¿Ya tienes una cuenta?
                  <span @click="goToLogin"
                    class="font-bold cursor-pointer text-blue-700">Inicia sesión.</span>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  mapActions, mapGetters, mapMutations, mapState,
} from 'vuex';
import ViewsMessages from '@/components/ViewsMessages.vue';
import Tracker from '@/components/Tracker.vue';
import chalan from '../../api/chalan';
import { track } from '../../utils/analytics';

// Reemplaza el registro con contraseña entre el paso 2 y el 3. Con un correo
// nuevo el API crea el cliente sin contraseña y devuelve la sesión; con uno que
// ya tiene cuenta liga la orden y manda el link de acceso a ese correo (no puede
// darle la sesión de otra cuenta a quien solo escribió su correo).
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Los errores de tipeo más comunes: un correo mal escrito es un cliente al que
// nunca le llega nada.
const DOMAIN_TYPOS = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'yaho.com': 'yahoo.com',
};

export default {
  name: 'order-contact',
  components: { Tracker, ViewsMessages },
  data() {
    return {
      viewName: 'register-login',
      fields: { name: '', email: '', mobilePhone: '' },
      errors: { name: null, email: null, mobilePhone: null },
      linkSentTo: null,
    };
  },
  mounted() {
    this.setLoader(false);
    if (this.isUserLogged) {
      this.$router.replace(this.redirect).catch(() => {});
      return;
    }
    // Sin orden en curso no hay nada que ligar: es alguien que llegó por un link
    // viejo, y lo que necesita es entrar con su cuenta.
    if (!this.currentOrder.order_id) {
      this.goToLogin();
      return;
    }
    this.fields.name = this.customer.customer_name || '';
    this.fields.email = this.customer.email || '';
    this.fields.mobilePhone = this.customer.mobile_phone || '';
  },
  methods: {
    ...mapMutations(['setCustomerData', 'setLoader', 'setViewsMessages']),
    ...mapActions(['addDataToLocalStorage']),
    goToLogin() {
      this.$router.push({ name: 'login', query: this.$route.query }).catch(() => {});
    },
    validate() {
      this.errors = { name: null, email: null, mobilePhone: null };
      Object.keys(this.fields).forEach((field) => {
        if (!this.fields[field]) this.errors[field] = 'no olvides llenar este campo';
      });
      if (this.fields.email && !EMAIL_RE.test(this.fields.email)) {
        this.errors.email = 'revisa tu correo, parece incompleto';
      }
      return !Object.values(this.errors).some(Boolean);
    },
    submit() {
      if (!this.validate()) return;
      this.setLoader(true);
      this.setViewsMessages({ view: this.viewName, message: null });
      chalan.orderContact({
        orderId: this.currentOrder.order_id,
        name: this.fields.name,
        email: this.fields.email,
        mobilePhone: this.fields.mobilePhone,
      })
        .then(({ status, data }) => {
          this.setLoader(false);
          if (status === 202) {
            this.linkSentTo = data.email;
            track('contact_existing_account', { order_id: this.currentOrder.order_id });
            return;
          }
          this.setCustomerData({ field: 'token', value: data.token });
          this.setCustomerData({ field: 'customer_id', value: this.decodeToken.id });
          this.setCustomerData({ field: 'email', value: data.email });
          this.setCustomerData({ field: 'mobile_phone', value: data.mobile_phone });
          this.setCustomerData({ field: 'customer_name', value: data.name });
          this.setCustomerData({ field: 'picture', value: '' });
          this.addDataToLocalStorage([
            'currentOrder', 'orderDetailsOrigin', 'orderDetailsDestination', 'services', 'customer',
          ]);
          track('sign_up', { method: 'contact' });
          this.$router.push(this.redirect).catch(() => {});
        })
        .catch((error) => {
          this.setLoader(false);
          const message = error.response?.data?.message;
          if (message === 'invalid email') {
            this.errors.email = 'revisa tu correo, parece incompleto';
            return;
          }
          let text = 'Ocurrió un error, intenta nuevamente o recarga la página';
          if (message === 'order already has a customer') {
            text = 'Este pedido ya está ligado a una cuenta. Entra con tu correo, o abre el link que te mandamos.';
          }
          this.setViewsMessages({ view: this.viewName, message: { text, type: 'error' } });
        });
    },
  },
  computed: {
    ...mapState(['currentOrder', 'customer', 'loading']),
    ...mapGetters(['isUserLogged', 'decodeToken']),
    redirect() {
      return this.$route.query.redirect || { name: 'step-three' };
    },
    emailSuggestion() {
      const [user, domain] = (this.fields.email || '').toLowerCase().split('@');
      const fixed = user && DOMAIN_TYPOS[domain];
      return fixed ? `${user}@${fixed}` : null;
    },
  },
};
</script>
