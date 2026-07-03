/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#0f1114',
          900: '#15181d',
          800: '#1c2027',
          700: '#252b35',
        },
        accent: {
          DEFAULT: '#e87722',
          hover: '#f0892f',
          muted: '#b85c18',
        },
      },
    },
  },
  plugins: [],
};
