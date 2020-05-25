<template>
  <div>
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
import { mapMutations, mapActions, mapGetters } from 'vuex';
import VFacebookLogin from 'vue-facebook-login-component';
import chalan from '../api/chalan';

export default {
  name: 'LoginFacebook',
  data() {
    return {
      appId: process.env.VUE_APP_FB_ID,
      personalID: '',
      email: '',
      name: '',
      scope: {},
      model: {},
      FB: {},
    };
  },
  mounted() {
    this.setLoader(false);
  },
  props: {
    redirect: String,
  },
  components: {
    VFacebookLogin,
  },
  methods: {
    ...mapActions([
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setCustomerData',
      'setFB',
      'setLoader',
    ]),
    getUserData() {
      this.FB.api('/me',
        'GET', { fields: 'id,name,email' },
        (userInformation) => {
          this.personalID = userInformation.id;
          this.email = userInformation.email;
          this.name = userInformation.name;
          this.FB.getLoginStatus((statusResponse) => {
            chalan.loginFacebook({
              email: this.email,
              name: this.name,
              token: statusResponse.authResponse.signedRequest,
            })
              .then((response) => {
                if (response.status === 201) {
                  this.setLoader(true);
                  this.handleUserData(response.data);
                  this.$router.push(this.redirect);
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
                this.$emit('error-message', errorMessages);
              });
          });
        });
    },
    handleUserData(data) {
      this.setCustomerData({ field: 'token', value: data.token });
      this.setCustomerData({ field: 'customer_id', value: this.decodeToken.id });
      this.setCustomerData({ field: 'customer_name', value: data.name });
      this.setCustomerData({ field: 'email', value: data.email });
      this.setCustomerData({ field: 'mobile_phone', value: data.mobile_phone });
      this.addDataToLocalStorage(['customer']);
    },
    login() {
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
