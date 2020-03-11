<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-1/4 max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <Login :redirect="redirect"></Login>
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
  },
  mounted() {
    this.getDataFromLocalStorage();
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'getDataFromLocalStorage',
      'validateRequiredFields',
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
    ]),
    confirmPayment() {
    },
  },
  computed: {
    ...mapState([
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'currentOrder',
      'isLoginFormDisplayed',
    ]),
    ...mapGetters([
      'isUserLogged',
    ]),
    redirect() {
      return this.$route.query.redirect || '/';
    },
  },
};
</script>
