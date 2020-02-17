<template>
    <div>
        <div class="flex flex-wrap">
            <div class="w-full mb-4">
                <Tracker></Tracker>
                <div class="w-full max-w-xl mx-auto">
                  Paso dos en proceso
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
