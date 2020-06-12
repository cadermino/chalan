<template>
  <header id="nav" class="bg-white
    border-b
    border-gray-300
    sm:flex
    sm:justify-between
    sm:items-center
    sm:px-4
    sm:py-3">
    <div class="flex items-center justify-between px-4 py-3 sm:p-0">
      <router-link :to="{name: 'home'}" class="block
        px-2
        py-1
        text-gray
        rounded">
        <img class="w-2/3" src="../../src/assets/logo_chalan.png" alt="chalan">
      </router-link>
      <div class="sm:hidden">
        <button @click="isOpen = !isOpen" type="button" class="block
          text-gray-500
          hover:text-grey
          focus:text-grey
          focus:outline-none">
          <svg class="h-6 w-6 fill-current" viewBox="0 0 24 24">
            <path v-if="isOpen" fill-rule="evenodd" d="M18.278
              16.864a1
              1
              0
              0
              1-1.414
              1.414l-4.829-4.828-4.828
              4.828a1
              1
              0
              0
              1-1.414-1.414l4.828-4.829-4.828-4.828a1
              1
              0
              0
              1
              1.414-1.414l4.829
              4.828
              4.828-4.828a1
              1
              0
              1
              1
              1.414
              1.414l-4.828
              4.829
              4.828
              4.828z"/>
            <path v-if="!isOpen" fill-rule="evenodd" d="M4
              5h16a1
              1
              0
              0
              1
              0
              2H4a1
              1
              0
              1
              1
              0-2zm0
              6h16a1
              1
              0
              0
              1
              0
              2H4a1
              1
              0
              0
              1
              0-2zm0
              6h16a1
              1
              0
              0
              1
              0
              2H4a1
              1
              0
              0
              1
              0-2z"/>
          </svg>
        </button>
      </div>
    </div>
    <nav :class="isOpen ? 'block' : 'hidden'" class="sm:block">
      <div class="px-2 pt-2 pb-4 sm:flex sm:p-0">
        <router-link
          :to="{name: 'step-one'}"
          @click.native="isOpen = false"
          class="block
          px-2
          py-1
          text-gray
          rounded">
          Iniciar
        </router-link>
        <a href="/landing/contacto" class="mt-1
          block
          px-2
          py-1
          text-gray
          sm:mt-0
          sm:ml-2">Contacto</a>
        <a href="/landing/nosotros" class="mt-1
          block
          px-2
          py-1
          text-gray
          sm:mt-0
          sm:ml-2">Nosotros</a>
        <router-link  v-if="!isUserLogged"
          :to="{name: 'register-login'}"
          @click.native="isOpen = false"
          class="block
          px-2
          py-1
          text-grey
          sm:mt-0
          sm:ml-2">
          Regístrate/inicia sesión
        </router-link>
        <AccountDropdown v-if="isUserLogged"
          class="hidden sm:block sm:ml-6"/>
      </div>
      <div v-if="isUserLogged"
        class="px-4 py-5 border-t border-gray-300 sm:hidden">
        <div v-if= "isUserLogged" class="flex items-center mb-4">
          <i v-if="!customer.picture"
          class="py-2
          px-3
          fa
          fa-user
          h-10
          w-10
          border-2
          border-gray-600
          rounded-full"
          aria-hidden="true"></i>
          <img v-if="customer.picture"
            class="h-10
            w-10
            border-2
            border-gray-600
            rounded-full
            object-cover"
            :src="customer.picture.data.url" alt="Your avatar">
          <span class="ml-3 font-semibold text-grey">{{ customer.customer_name }}</span>
        </div>
        <div class="">
          <router-link
            :to="{name: 'dashboard'}"
            @click.native="isOpen = false"
            class="block text-gray hover:text-gray-500">
            Mis ordenes
          </router-link>
          <a @click="logout" class="mt-2 block text-gray hover:text-white">Salir</a>
        </div>
      </div>
    </nav>
  </header>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex';
import AccountDropdown from '@/components/AccountDropdown.vue';

export default {
  name: 'Navbar',
  data() {
    return {
      isOpen: false,
    };
  },
  components: {
    AccountDropdown,
  },
  methods: {
    ...mapActions([
      'logout',
    ]),
  },
  computed: {
    ...mapGetters([
      'isUserLogged',
    ]),
    ...mapState([
      'customer',
    ]),
  },
};
</script>
<style lang="scss">
#nav {
  a {
    &.router-link-exact-active {
      font-weight: bold;
    }
  }
}
</style>
