<template>
    <div>
        <div class="flex flex-wrap">
            <div class="w-full mb-4">
                <Tracker></Tracker>
                <div class="w-full max-w-xl mx-auto">
                  <form class="bg-white px-8 pt-6 pb-8 mb-4">
                    <p class="text-center font-bold mb-10">
                      Elige el tamaño de vehículo que deseas
                    </p>
                    <div class="flex flex-wrap -mx-3 mb-4">
                      <div class="w-full md:w-1/3 px-3 mb-4">
                        <label class="block
                        text-gray-700
                        text-sm
                        font-bold mb-2" for="address-from-floor">
                            Piso de la vivienda <span class="text-red-500">*</span>
                        </label>
                        <div class="relative">
                          <select
                          :class="formValidationMessages['from_floor_number']
                          ?'border-red-300':''"
                          class="appearance-none
                          border
                          bg-white
                          rounded
                          w-full
                          py-2
                          px-3
                          text-gray-700
                          leading-tight
                          focus:outline-none
                          focus:border-blue-400"
                          id="address-from-floor"
                          v-model="selectedFromFloor">
                            <option disabled value="">Tamaño de vehículo</option>
                            <option
                            v-for="(item, index) in floorList"
                            v-bind:value="index"
                            v-bind:key="index">
                              {{ item }}
                            </option>
                          </select>
                          <div class="pointer-events-none
                              absolute
                              inset-y-0
                              right-0
                              flex
                              items-center
                              px-2
                              text-gray-700">
                          <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                          </div>
                        </div>
                        <p v-if="formValidationMessages['from_floor_number']"
                        class="text-red-500
                        text-xs
                        italic">{{ formValidationMessages['from_floor_number'] }}.</p>
                      </div>
                    </div>
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
                  </form>
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
      viewName: 'step-two',
    };
  },
  components: {
    Tracker,
  },
  mounted() {
    // this.validateRequiredFields(this.viewName);
    if (!this.steps['step-one'].isComplete) {
      this.$router.push('step-one');
    }
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'validateRequiredFields',
    ]),
    ...mapMutations([
      'setOrder',
      'setMessage',
    ]),
  },
  computed: {
    ...mapState([
      'formValidationMessages',
      'steps',
    ]),
  },
};
</script>
