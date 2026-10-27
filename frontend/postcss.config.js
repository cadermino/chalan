const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

// Tailwind 3 escribe inset-0 como `inset: 0px`, que Safari entiende desde la
// 14.1; sin esto los fondos de Login y Modal quedan sin tamaño en iPhones
// viejos. Tailwind 1 escribía las cuatro propiedades.
const expandInset = {
  postcssPlugin: 'expand-inset',
  Declaration: {
    inset(decl) {
      if (decl.value.trim().includes(' ')) return;
      for (const side of ['top', 'right', 'bottom', 'left']) {
        decl.cloneBefore({ prop: side });
      }
      decl.remove();
    },
  },
};

module.exports = {
  plugins: [
    tailwindcss,
    expandInset,
    autoprefixer,
  ],
};
