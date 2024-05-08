module.exports = {
  theme: {
    extend: {
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: 1 },
          '40%': { opacity: 0.4 },
        },
      },
    },
    inset: {
      0: 0,
      auto: 'auto',
      '1/2': '50%',
    },
  },
  variants: {},
  plugins: [],
};
