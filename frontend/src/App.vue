<template v-cloak>
  <div id="app">
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
    <nav id="nav">
      <div
        class="container
        mx-auto
        px-6
        py-2
        flex
        justify-between
        items-center border-b-2 border-gray-200"
      >
        <router-link to="/" class="font-bold text-2xl lg:text-4xl">
          <img class="w-2/3" src="../src/assets/logo_chalan.png" alt="">
        </router-link>
        <div class="block lg:hidden">
          <button
            class="flex items-center px-3 py-2 border rounded text-gray-500
                  border-gray-600 hover:text-gray-800 hover:border-teal-500
                  appearance-none focus:outline-none"
          >
            <svg
              class="fill-current h-3 w-3"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Menu</title>
              <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
            </svg>
          </button>
        </div>
        <div class="hidden lg:block">
          <ul class="inline-flex">
            <li>
              <router-link to="/" class="px-4">Inicio</router-link>
            </li>
            <li>
              <router-link to="/about" class="px-4 hover:text-gray-800">Nosotros</router-link>
            </li>
            <li>
              <router-link
                to="/register-login"
                class="px-4 hover:text-gray-800">
                Regístrate/inicia sesión
              </router-link>
            </li>
            <li>
              <a class="px-4 hover:text-gray-800" href="#">Contact</a>
            </li>
            <li @click="logout"
              class="cursor-pointer">
              Salir
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <router-view/>
    <Footer></Footer>
  </div>
</template>

<style lang="scss">
#nav {
  a {
    &.router-link-exact-active {
      font-weight: bold;
    }
  }
}
</style>

<script>
import { mapActions, mapState } from 'vuex';
import Footer from '@/components/Footer.vue';

export default {
  name: 'app',
  components: {
    Footer,
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
