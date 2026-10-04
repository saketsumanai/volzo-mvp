/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f2ff',
          100: '#cce5ff',
          200: '#99ccff',
          300: '#66b3ff',
          400: '#3399ff',
          500: '#0066FF', // Volzo Blue
          600: '#0052CC',
          700: '#003d99',
          800: '#002966',
          900: '#001433',
        },
        secondary: {
          500: '#00D9FF', // Volzo Light Blue
        },
        accent: {
          500: '#5FD068', // Volzo Green
        },
      },
    },
  },
  plugins: [],
}
