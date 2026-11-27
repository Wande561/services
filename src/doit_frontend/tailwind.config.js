/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orange: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        black: '#000000',
        home: {
          canvas: '#202d38',
          surface: '#293a46',
          raised: '#314551',
          line: '#41545e',
          control: '#677c86',
          text: '#eef2f0',
          muted: '#b7c6ce',
          accent: '#adc1b7',
          'accent-hover': '#bed0c7',
          'action-ink': '#20332f',
        },
      },
      fontFamily: {
        sans: ['Source Sans 3', 'system-ui', 'sans-serif'],
        home: ['Source Sans 3', 'Manrope', 'system-ui', 'sans-serif'],
        editorial: ['Alegreya', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
