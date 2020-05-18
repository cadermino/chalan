<template>
  <div>
    <div class="flex flex-wrap my-10">
      <div class="w-full mb-4 max-w-xl mx-auto">
        <div class="">
          <h1 class="text-center ">
            {{ currentOrder.customer_name }} Tu mudanza ha sido agendada!
          </h1>
        </div>
        <div class="text-center">
          <h3 class="h2">
          </h3>
          <p></p>
          <div class="mt-10">
            <router-link to="/" class="bg-blue-500
              hover:bg-blue-700
              text-white
              font-bold
              rounded
              py-2 px-4
              tracking-wider">
              Volver
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapMutations, mapActions } from 'vuex';

export default {
  name: 'dashboard',
  props: ['state'],
  mounted() {
    this.addDataToLocalStorage(['currentOrder']);
  },
  methods: {
    ...mapActions([
      'currentOrder',
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
    ]),
  },
};
</script>
