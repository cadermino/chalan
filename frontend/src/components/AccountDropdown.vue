<template>
  <div class="relative">
    <div class="hidden sm:block sm:ml-6">
      <button @click="isOpen = !isOpen"
        class="relative
          z-10
          block
          h-8
          w-10
          rounded-full
          overflow-hidden
          border-2
          border-gray-600
          focus:outline-none">
        <img v-if="customer.picture"
          class="h-full w-full object-cover" :src="customer.picture.data.url" alt="Your avatar">
        <i class="fa fa-user" aria-hidden="true"></i>
      </button>
      <button v-if="isOpen"
        @click="isOpen = false"
        tabindex="-1"
        class="fixed inset-0 h-full w-full bg-black opacity-50 cursor-default"></button>
      <div v-if="isOpen" class="absolute right-0 mt-2 py-2 w-48 bg-white rounded-lg shadow-xl z-50">
        <router-link
          :to="{name: 'dashboard'}"
          @click.native="isOpen = false"
          class="block
          px-4
          py-2
          text-gray
          hover:bg-blue-500
          hover:text-white">
          Mis ordenes
        </router-link>
        <div class="block
          cursor-pointer
          px-4
          py-2
          text-gray
          hover:bg-blue-500
          hover:text-white"
          @click="logout">Salir</div>
      </div>
    </div>
    <div
      class="px-4 py-5 border-t border-gray-300 sm:hidden">
      <div class="flex items-center mb-4">
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
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';

export default {
  data() {
    return {
      isOpen: false,
    };
  },
  created() {
    const handleEscape = (e) => {
      if (e.key === 'Esc' || e.key === 'Escape') {
        this.isOpen = false;
      }
    };
    document.addEventListener('keydown', handleEscape);
    this.$once('hook:beforeDestroy', () => {
      document.removeEventListener('keydown', handleEscape);
    });
  },
  methods: {
    ...mapActions([
      'logout',
    ]),
  },
  computed: {
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
