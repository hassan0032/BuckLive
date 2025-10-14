/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        'brand-primary': '#00b5e6',
        'brand-secondary': '#04477f',
        'brand-d-blue': '#1666a9',
        'brand-dd-blue': '#363F49',
        'brand-beige': '#edeae2',
        'brand-beige-light': '#f3f2f1',
        'brand-gray-lighter': '#708297',
        'brand-gray-light': '#556474',
        'brand-gray': '#363F49',
        'brand-gray-dark': '#2B333B',
        'brand-gray-darker': '#232629',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
