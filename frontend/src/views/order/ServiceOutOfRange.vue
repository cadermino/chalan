<template>
  <div>
    <div class="flex flex-wrap my-10">
      <div class="w-full mb-4 max-w-xl mx-auto">
        <div class="">
          <h1 class="text-center ">Lo sentimos :(</h1>
        </div>
        <div class="text-center">
          <h3 class="h2">
            Todavía no contamos con servicio en <span class="font-bold">{{ state }}</span>
          </h3>
          <p>Estamos trabajando para extender Chalán a toda la republica 🦾 🇲🇽</p>
          <div class="mt-10">
            <router-link to="/order/step-one" class="bg-blue-500
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
  name: 'serviceOutOfRange',
  props: ['state'],
  mounted() {
    this.setOrder({ field: 'is_out_of_range', value: true });
    this.addDataToLocalStorage(['currentOrder']);
  },
  methods: {
    ...mapActions([
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
    ]),
  },
};
</script>
