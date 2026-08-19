<template>
  <div v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="onBackdropClick">
    <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 relative">
      <button v-if="closable"
        type="button"
        aria-label="Cerrar"
        @click="$emit('close')"
        class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none">
        &times;
      </button>
      <p v-if="title" class="text-center font-bold mb-2">{{ title }}</p>
      <slot />
    </div>
  </div>
</template>

<script>
export default {
  name: 'Modal',
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    title: {
      type: String,
      default: null,
    },
    closable: {
      type: Boolean,
      default: true,
    },
  },
  created() {
    const handleEscape = (e) => {
      if (this.closable && (e.key === 'Esc' || e.key === 'Escape')) {
        this.$emit('close');
      }
    };
    document.addEventListener('keydown', handleEscape);
    this.$once('hook:beforeDestroy', () => {
      document.removeEventListener('keydown', handleEscape);
    });
  },
  methods: {
    onBackdropClick() {
      if (this.closable) {
        this.$emit('close');
      }
    },
  },
};
</script>
