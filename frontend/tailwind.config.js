/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Barlow Condensed', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef4f9',
          100: '#d0e4f0',
          200: '#a3c9e2',
          300: '#6aaed1',
          400: '#3d92bf',
          500: '#2378a8',
          600: '#1e6390',
          700: '#1a5078',
          800: '#143e5e',
          900: '#0e2d44',
        },
        // Finish-line amber — podium finishes, PB highlights only
        finish: {
          400: '#f0a832',
          500: '#e8962a',
          600: '#c97a1e',
        },
      },
    },
  },
  plugins: [],
};
