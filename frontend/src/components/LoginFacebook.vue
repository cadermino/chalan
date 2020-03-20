<template>
  <div>
    <v-facebook-login
      style="width: 100%"
      :app-id="appId"
      v-model="model"
      @sdk-init="handleSdkInit"
      @login="login"
      @logout="logout"
      @click="click">
      <template slot="login">Continuar con Facebook</template>
      <template slot="logout">Salir</template>
    </v-facebook-login>
    <!-- <button v-if="scope.logout && model.connected" @click="scope.logout">
      Logout
    </button> -->
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
      'setOrder',
      'setFB',
    ]),
    getUserData() {
      this.FB.api('/me',
        'GET', { fields: 'id,name,email' },
        (userInformation) => {
          // console.log(userInformation);
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
                console.log(response);
                if (response.status === 201) {
                  this.handleUserData(response.data.token);
                  this.$router.push(this.redirect);
                }
              })
              .catch((error) => {
                let errorMessages;
                // this.errorMessages =
                //   'Ocurrio un error, por favor intenta nuevamente o recarga la página';
                if (error.response && error.response.data.message === 'invalid token') {
                  errorMessages = 'Token invalido';
                } else {
                  errorMessages = 'Ocurrio un error, por favor intenta nuevamente o recarga la página';
                }
                this.$emit('error-message', errorMessages);
              });
            console.log('getLoginStatus', statusResponse);
          });
        });
    },
    handleUserData(token) {
      // this.resetMessages();
      this.setOrder({ field: 'token', value: token });
      this.setOrder({ field: 'customer_id', value: this.decodeToken.id });
      this.addDataToLocalStorage(['currentOrder']);
    },
    login() {
      console.log('entro login()');
      this.getUserData();
    },
    logout() {
      console.log('entro logout()');
    },
    click() {
      console.log('entro click()');
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
