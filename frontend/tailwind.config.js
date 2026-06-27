/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Barlow Condensed', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        data: ['Geist Mono', 'ui-monospace', 'monospace'],
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
        // Finish-line copper — PBs and podium only; scarcity is load-bearing
        finish: {
          400: '#d4923a',
          500: '#c87f3e',
          600: '#a8662e',
        },
      },
    },
  },
  plugins: [],
};
