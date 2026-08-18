<template>
  <div class="flex items-center mb-8">
    <div v-if="showMessage"
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
      <ul v-if="visibleItems.length"
        class="list-disc list-inside mt-1">
        <li v-for="(item, index) in visibleItems" :key="index">
          {{ item }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import { fieldLabels } from '@/store';

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
      'formValidationMessages',
    ]),
    visibleItems() {
      const message = this.viewsMessages[this.viewName];
      if (!message || !message.items) return [];
      const labels = message.items
        .filter(field => this.formValidationMessages[field])
        .map(field => fieldLabels[field] || field);
      return [...new Set(labels)];
    },
    showMessage() {
      const message = this.viewsMessages[this.viewName];
      if (!message) return false;
      return message.items ? this.visibleItems.length > 0 : true;
    },
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
