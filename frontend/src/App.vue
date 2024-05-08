<template v-cloak>
  <div id="app">
    <a :href="`https://api.whatsapp.com/send?phone=${phone}`"
      target="_blank"
      id="whatsapp" class="z-50
      fixed
      bottom-1/2
      right-0
      mb-5
      "><i class="
        px-3
        py-1
        rounded-lg
        bg-green-400
        text-white
        text-5xl
        fa
        fa-whatsapp" aria-hidden="true"></i></a>
    <div v-if="loading"
      class="w-full
      h-full
      fixed
      block
      top-0
      left-0
      bg-white
      opacity-75
      z-50">
      <span class="text-blue-500
        opacity-75
        top-1/2
        my-0
        mx-auto
        block
        relative
        w-0
        h-0"
        style="top: 50%;">
        <i class="fas fa-circle-notch fa-spin fa-5x"></i>
      </span>
    </div>
    <!--Nav-->
    <Navbar></Navbar>
    <router-view/>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import Navbar from '@/components/Navbar.vue';

import countryData from './countryData';

const country = process.env.VUE_APP_COUNTRY;

export default {
  name: 'app',
  data() {
    return {
      phone: countryData[country].general.phone,
    };
  },
  components: {
    Navbar,
  },
  methods: {
    ...mapActions([
      'logout',
    ]),
  },
  computed: {
    ...mapState([
      'loading',
    ]),
  },
};
</script>
