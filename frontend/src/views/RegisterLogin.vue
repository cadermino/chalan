<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="xl:w-1/4 max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>
          <Login
            :redirect="redirect"
            v-on:user-logged="updateOrder"
          >
          </Login>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  mapState, mapActions, mapMutations, mapGetters,
} from 'vuex';
import Login from '@/components/Login.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import Tracker from '@/components/Tracker.vue';
import chalan from '../api/chalan';

export default {
  name: 'register-login',
  data() {
    return {
      viewName: 'register-login',
    };
  },
  components: {
    Tracker,
    Login,
    ViewsMessages,
  },
  mounted() {
    if (this.isUserLogged) {
      this.$router.push(this.redirect);
    }
    if (this.redirect !== '/') {
      this.setViewsMessages({
        view: this.viewName,
        message: {
          text: 'Para continuar con el proceso registrate o inicia sesión',
          type: 'info',
        },
      });
    }
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setViewsMessages',
      'setLoader',
    ]),
    updateOrder() {
      if (this.currentOrder.order_id) {
        const payload = {
          order: this.currentOrder,
          customer: this.customer,
          requestQuotationFromCarrierCompany: true,
        };
        chalan.updateOrder(payload)
          .then((response) => {
            if (response.status === 200) {
              this.setLoader(false);
              this.addDataToLocalStorage([
                'currentOrder',
                'customer',
              ]);
              this.$router.push(this.redirect);
            }
          })
          .catch(() => {
            this.setLoader(false);
            this.setViewsMessages({
              view: this.viewName,
              message: {
                text: 'Hubo un error, intenta después de recargar la página',
                type: 'error',
              },
            });
          });
      } else {
        this.addDataToLocalStorage([
          'currentOrder',
          'customer',
        ]);
        this.$router.push(this.redirect);
      }
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
      'viewsMessages',
    ]),
    ...mapGetters([
      'isUserLogged',
    ]),
    redirect() {
      return this.$route.query.redirect || '/dashboard';
    },
  },
};
</script>
