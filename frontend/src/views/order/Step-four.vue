<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <div class="flex items-center mb-8">
            <div v-if="viewsMessages[viewName]"
              class="bg-red-100
              w-full
              border
              border-red-400
              text-red-700
              px-4
              py-3
              rounded
              relative"
              role="alert">
              <strong class="font-bold">Oops! </strong>
              <span class="block sm:inline">
                {{ viewsMessages[viewName] }}
              </span>
            </div>
          </div>
          <p class="text-center font-bold mb-10">
            Datos de tu mudanza
          </p>
          <div class="flex flex-wrap mb-4">
            <div class="w-full px-3 mb-4">
            </div>
          </div>
          <div class="flex items-center justify-between">
            <router-link to="/order/step-two" class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400">
              Atras
            </router-link>
            <button
              type="button"
              class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400">
              Siguiente
              </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  mapState, mapActions, mapMutations, mapGetters,
} from 'vuex';
import Tracker from '@/components/Tracker.vue';

export default {
  name: 'step-four',
  data() {
    return {
      viewName: 'step-four',
    };
  },
  components: {
    Tracker,
  },
  mounted() {
    this.getDataFromLocalStorage();
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'getDataFromLocalStorage',
      'validateRequiredFields',
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
    ]),
    confirmPayment() {
    },
  },
  computed: {
    ...mapState([
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'currentOrder',
    ]),
    ...mapGetters([
      'isUserLogged',
    ]),
  },
};
</script>
