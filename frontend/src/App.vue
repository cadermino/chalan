<template>
  <div id="app">
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
        <router-link to="/" class="font-bold text-2xl lg:text-4xl">chalan.mx</router-link>
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
            <li @click="logout">
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
import { mapActions } from 'vuex';
import Footer from '@/components/Footer.vue';

export default {
  name: 'app',
  components: {
    Footer,
  },
  mounted() {
    this.$moment.locale('es');
  },
  methods: {
    ...mapActions([
      'logout',
    ]),
  },
};
</script>
