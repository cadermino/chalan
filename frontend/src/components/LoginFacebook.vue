<template>
  <div>
    <div class="w-full mb-4">
      <label class="block
        text-gray-700
        text-sm
        font-bold mb-2" for="mobilePhone">
          Teléfono móvil <span class="text-red-500">*</span>
      </label>
      <input :class="registerFormValidationMessages['mobilePhone']
        ?'border-red-300':''"
        class="appearance-none
        border rounded
        w-full
        py-2
        px-3
        text-gray-700
        leading-tight
        focus:outline-none
        focus:border-blue-400"
        v-model="mobilePhone"
        type="number">
      <p v-if="registerFormValidationMessages['mobilePhone']"
        class="text-red-500
        text-xs
        italic">{{ registerFormValidationMessages['mobilePhone'] }}.</p>
    </div>
    <v-facebook-login
      style="width: 100%"
      :app-id="appId"
      v-model="model"
      @sdk-init="handleSdkInit"
      @login="login">
      <template slot="working">Por favor espera...</template>
      <template slot="login">Continuar con Facebook</template>
      <template slot="logout">Salir</template>
    </v-facebook-login>
  </div>
</template>

<script>
import { mapMutations, mapGetters } from 'vuex';
import VFacebookLogin from 'vue-facebook-login-component';
import chalan from '../api/chalan';

export default {
  name: 'LoginFacebook',
  data() {
    return {
      registerFormValidationMessages: {
        mobilePhone: null,
      },
      mobilePhone: null,
      appId: process.env.VUE_APP_FB_ID,
      personalID: '',
      email: '',
      name: '',
      picture: '',
      scope: {},
      model: {},
      FB: {},
    };
  },
  watch: {
    mobilePhone(value) {
      if (value.length >= 10) {
        this.registerFormValidationMessages.mobilePhone = '';
        document.getElementsByClassName('v-facebook-login')
          .item(0).removeAttribute('disabled');
      } else {
        document.getElementsByClassName('v-facebook-login')
          .item(0).setAttribute('disabled', 'disabled');
      }
    },
  },
  mounted() {
    this.setLoader(false);
  },
  updated() {
    if (!this.mobilePhone) {
      document.getElementsByClassName('v-facebook-login')
        .item(0).setAttribute('disabled', 'disabled');
      this.registerFormValidationMessages.mobilePhone = 'Proporciona un número móvil válido';
    }
  },
  components: {
    VFacebookLogin,
  },
  methods: {
    ...mapMutations([
      'setCustomerData',
      'setFB',
      'setLoader',
      'setViewsMessages',
    ]),
    getUserData() {
      this.FB.api('/me',
        'GET', { fields: 'id,name,email,picture' },
        (userInformation) => {
          this.personalID = userInformation.id;
          this.email = userInformation.email;
          this.name = userInformation.name;
          this.picture = userInformation.picture;
          this.FB.getLoginStatus((statusResponse) => {
            chalan.loginFacebook({
              email: this.email,
              mobilePhone: this.mobilePhone,
              name: this.name,
              token: statusResponse.authResponse.signedRequest,
            })
              .then((response) => {
                if (response.status === 201) {
                  this.handleUserData(response.data);
                  this.$emit('facebook-logged');
                }
              })
              .catch((error) => {
                this.setLoader(false);
                let errorMessages;
                if (error.response && error.response.data.message === 'invalid token') {
                  errorMessages = 'Token invalido';
                } else {
                  errorMessages = 'Ocurrio un error, por favor intenta nuevamente o recarga la página';
                }
                this.setViewsMessages({
                  view: 'register-login',
                  message: {
                    text: errorMessages,
                    type: 'error',
                  },
                });
              });
          });
        });
    },
    handleUserData(data) {
      this.setCustomerData({ field: 'token', value: data.token });
      this.setCustomerData({ field: 'customer_id', value: this.decodeToken.id });
      this.setCustomerData({ field: 'customer_name', value: data.name });
      this.setCustomerData({ field: 'email', value: data.email });
      this.setCustomerData({ field: 'mobile_phone', value: this.mobilePhone });
      this.setCustomerData({ field: 'picture', value: this.picture });
    },
    login() {
      this.setLoader(true);
      this.getUserData();
    },
    handleSdkInit({ FB, scope }) {
      this.FB = FB;
      this.setFB(FB);
      this.scope = scope;
    },
  },
  computed: {
    ...mapGetters([
      'decodeToken',
    ]),
  },
};
</script>
