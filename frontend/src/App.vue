<template>
  <div>
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
    <ChatWidget v-if="showChat" />
  </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useStore } from '@/store';
import Navbar from '@/components/Navbar.vue';
import ChatWidget from '@/components/ChatWidget.vue';

// Sin chat en el link de cotizar del transportista ni en los pasos de la orden:
// la burbuja, fija abajo a la derecha, tapaba "Siguiente" en el celular.
const ROUTES_WITHOUT_CHAT = ['quotation', 'step-one', 'step-two', 'step-three', 'order-contact'];

export default {
  name: 'app',
  components: {
    Navbar,
    ChatWidget,
  },
  created() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      document.cookie = `chalan_ref=${ref};path=/;max-age=${30 * 24 * 60 * 60}`;
    }
  },
  methods: {
    ...mapActions(useStore, [
      'logout',
    ]),
  },
  computed: {
    ...mapState(useStore, [
      'loading',
    ]),
    showChat() {
      return !ROUTES_WITHOUT_CHAT.includes(this.$route.name);
    },
  },
};
</script>
