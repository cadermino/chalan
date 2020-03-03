<template>
    <div class="max-w-xl mx-auto my-4 border-b-2 pt-16">
        <div class="flex pb-3 justify-around">
          <div v-for="(item, key, index) in steps"
              v-bind:key="index"
              :class="(index+1 !== stepObjectLength)?'w-1/3':'ml-3'">
            <div class="w-full flex mb-4">
              <div class="flex-1">
                <div v-if="item.isComplete"
                :class="[(index+1 !== stepObjectLength)?'mx-auto':'',
                            (item.isComplete)?'mx-auto':'']"
                class="w-10
                h-10
                bg-green-500
                rounded-full
                text-lg
                text-white
                flex
                items-center">
                  <span class="text-white text-center w-full">
                    <i class="fa fa-check w-full fill-current white"></i>
                  </span>
                </div>
                <div v-if="!item.isComplete"
                :class="(currentView==key) ?
                'bg-gray-400 border-gray-400' : 'bg-white border-gray-light'"
                class="w-10
                h-10
                border-2
                mx-auto rounded-full text-lg text-white flex items-center">
                  <span :class="(currentView==key) ? 'text-gray-100' : 'text-gray-500'"
                    class="text-center w-full">
                    {{ index+1 }}
                  </span>
                </div>

                <div :class="(index+1 !== stepObjectLength)?'text-center':''"
                  class="w-full text-xs mt-3">
                  {{ item.name }}
                </div>
              </div>

              <div v-if="(index + 1) !== stepObjectLength"
                   class="w-full pt-4">
                <div class="w-full
                bg-gray-200
                rounded
                items-center
                align-middle
                align-center
                flex-1">
                  <div class="bg-green-300
                  text-xs
                  leading-none
                  py-1
                  text-center
                  text-gray-700 rounded " :style="item.isComplete? 'width: 100%' : 'width: 0%'">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
</template>

<script>
import { mapMutations } from 'vuex';

export default {
  name: 'Tracker',
  data() {
    return {
    };
  },
  props: {
    currentView: String,
  },
  mounted() {
    this.verifyStepStatus();
  },
  components: {},
  watch: {
    currentOrder: {
      handler() {
        this.verifyStepStatus();
      },
      deep: true,
    },
  },
  methods: {
    ...mapMutations([
      'verifyStepStatus',
    ]),
  },
  computed: {
    steps() {
      return this.$store.state.steps;
    },
    currentOrder() {
      return this.$store.state.currentOrder;
    },
    stepObjectLength() {
      return Object.keys(this.steps).length;
    },
  },
};
</script>
