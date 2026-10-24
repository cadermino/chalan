<template>
  <div v-if="visible"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="onBackdropClick">
    <div class="modal-panel bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 relative">
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
  emits: ['close'],
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
    // El listener es global y el componente sigue montado con visible en
    // false (el v-if está dentro de su propio template), así que sin
    // comprobar `visible` un Escape en cualquier parte de la página emite
    // close. En Step-one eso disparaba el flujo de "omitir" del modal de
    // WhatsApp y navegaba a step-two sin que el modal se hubiera mostrado.
    this.handleEscape = (e) => {
      if (this.visible && this.closable && (e.key === 'Esc' || e.key === 'Escape')) {
        this.$emit('close');
      }
    };
    document.addEventListener('keydown', this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscape);
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

<style scoped>
/* El fondo es fixed y centra sin scroll propio: un modal más alto que la
   pantalla (el de pago en un celular, con QR y campos) quedaba cortado arriba
   y abajo sin forma de llegar al botón. El panel scrollea en vez de salirse. */
.modal-panel {
  max-height: 90vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
@supports (height: 100dvh) {
  .modal-panel {
    max-height: 90dvh;
  }
}
</style>
