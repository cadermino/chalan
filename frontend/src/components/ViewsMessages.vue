<template>
  <div class="flex items-center mb-8">
    <div v-if="viewsMessages[viewName]"
      :class="messageClasses"
      class="w-full
      border
      px-4
      py-3
      rounded
      relative"
      role="alert">
      <span class="block sm:inline">
        {{ viewsMessages[viewName].text }}
      </span>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';

export default {
  name: 'ViewsMessages',
  data() {
    return {
      isOpen: false,
    };
  },
  props: ['viewName'],
  computed: {
    ...mapGetters([
      'isUserLogged',
    ]),
    ...mapState([
      'customer',
      'viewsMessages',
    ]),
    messageClasses() {
      const classes = [];
      if (this.viewsMessages[this.viewName].type === 'error') {
        classes.push('bg-red-100', 'border-red-400', 'text-red-700');
      } else if (this.viewsMessages[this.viewName].type === 'info') {
        classes.push('bg-blue-100', 'border-blue-400', 'text-blue-700');
      } else if (this.viewsMessages[this.viewName].type === 'success') {
        classes.push('bg-green-100 border-green-400', 'text-green-700');
      }
      return classes;
    },
  },
};
</script>
