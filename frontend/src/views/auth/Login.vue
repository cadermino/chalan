<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="xl:w-1/4 max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>
          <LoginForm
            initial-form="login"
            v-on:user-logged="updateOrder"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useStore } from '@/store';
import LoginForm from '@/components/Login.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import Tracker from '@/components/Tracker.vue';
import chalan from '../../api/chalan';

export default {
  name: 'login-view',
  data() {
    return { viewName: 'register-login' };
  },
  components: { Tracker, LoginForm, ViewsMessages },
  mounted() {
    if (this.isUserLogged) {
      this.$router.push(this.redirect).catch(() => {});
    }
    // Sin pisar un aviso que ya trae la pantalla, como el de un link de
    // acceso vencido (views/OrderAccess.vue).
    if (this.redirect !== '/' && !this.viewsMessages[this.viewName]) {
      this.setViewsMessages({
        view: this.viewName,
        message: {
          text: 'Para continuar con el proceso inicia sesión',
          type: 'info',
        },
      });
    }
  },
  methods: {
    ...mapActions(useStore, ['addDataToLocalStorage', 'fetchLastPendingOrder']),
    ...mapActions(useStore, ['setViewsMessages', 'setLoader']),
    updateOrder() {
      if (this.currentOrder.order_id) {
        const payload = {
          order: this.currentOrder,
          orderDetailsOrigin: this.orderDetailsOrigin,
          orderDetailsDestination: this.orderDetailsDestination,
          services: this.services,
          customer: this.customer,
        };
        chalan.updateOrder(payload)
          .then((response) => {
            if (response.status === 200) {
              this.setLoader(false);
              this.addDataToLocalStorage([
                'currentOrder', 'orderDetailsOrigin',
                'orderDetailsDestination', 'services', 'customer',
              ]);
              this.$router.push(this.redirect).catch(() => {});
            }
          })
          .catch(() => {
            this.setLoader(false);
            this.setViewsMessages({
              view: this.viewName,
              message: { text: 'Hubo un error, intenta después de recargar la página', type: 'error' },
            });
          });
      } else {
        this.fetchLastPendingOrder()
          .then(() => {
            this.addDataToLocalStorage([
              'currentOrder', 'orderDetailsOrigin',
              'orderDetailsDestination', 'services', 'customer',
            ]);
            this.setLoader(false);
            this.$router.push(this.redirect).catch(() => {});
          })
          .catch(() => {
            this.addDataToLocalStorage([
              'currentOrder', 'orderDetailsOrigin',
              'orderDetailsDestination', 'services', 'customer',
            ]);
            this.setLoader(false);
            this.$router.push(this.redirect).catch(() => {});
          });
      }
    },
  },
  computed: {
    ...mapState(useStore, ['currentOrder', 'customer', 'orderDetailsDestination', 'orderDetailsOrigin', 'services', 'viewsMessages']),
    ...mapState(useStore, ['isUserLogged']),
    redirect() {
      return this.$route.query.redirect || '/dashboard';
    },
  },
};
</script>
