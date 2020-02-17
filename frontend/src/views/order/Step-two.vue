<template>
    <div>
        <div class="flex flex-wrap">
            <div class="w-full mb-4">
                <Tracker></Tracker>
                <div class="w-full max-w-xl mx-auto">
                  Paso dos en proceso
                  <div class="border-b border-1 my-10"></div>
                  <div class="flex items-center justify-between">
                      <router-link to="/order/step-one"
                        class="bg-green-500
                        hover:bg-green-700
                        text-white
                        py-2
                        px-4
                        rounded
                        focus:outline-none
                        focus:border-blue-400">
                        Atras
                      </router-link>
                      <router-link to="/order/step-two"
                        class="bg-green-500
                        hover:bg-green-700
                        text-white
                        py-2
                        px-4
                        rounded
                        focus:outline-none
                        focus:border-blue-400">
                        Siguiente
                      </router-link>
                  </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';
// @ is an alias to /src
import Tracker from '@/components/Tracker.vue';

export default {
  name: 'step-two',
  data() {
    return {
    };
  },
  components: {
    Tracker,
  },
  mounted() {
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'createOrder',
      'getAddress',
    ]),
    ...mapMutations([
      'setOrder',
      'setMessage',
    ]),
  },
  computed: {
    ...mapState([
      'currentOrder',
      'fromNeighborhoodList',
      'messages',
    ]),
  },
};
</script>
