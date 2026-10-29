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
import { mapState, mapActions } from 'pinia';
import { useStore } from '@/store';
import Login from '@/components/Login.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import Tracker from '@/components/Tracker.vue';

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
    ...mapActions(useStore, [
      'attachDraftAfterLogin',
    ]),
    ...mapActions(useStore, [
      'setViewsMessages',
      'setLoader',
    ]),
    updateOrder() {
      this.attachDraftAfterLogin()
        .then(({ discarded }) => {
          this.setLoader(false);
          // La orden del borrador no era suya: su panel muestra la última que sí.
          this.$router.push(discarded ? '/dashboard' : this.redirect).catch(() => {});
        })
        .catch(() => {
          this.setLoader(false);
          this.setViewsMessages({
            view: this.viewName,
            message: { text: 'Hubo un error, intenta después de recargar la página', type: 'error' },
          });
        });
    },
  },
  computed: {
    ...mapState(useStore, [
      'viewsMessages',
    ]),
    ...mapState(useStore, [
      'isUserLogged',
    ]),
    redirect() {
      return this.$route.query.redirect || '/dashboard';
    },
  },
};
</script>
