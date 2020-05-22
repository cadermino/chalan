<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="xl:w-1/4 max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <Login
            :redirect="redirect"
          >
          </Login>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex';
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
  mounted() {},
  props: [
  ],
  methods: {
    ...mapActions([]),
  },
  computed: {
    redirect() {
      return this.$route.query.redirect || '/';
    },
  },
};
</script>
