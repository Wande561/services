import colors from 'tailwindcss/colors';

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
        emerald: { ...colors.emerald, 50: '#fff3ec', 100: '#fae7dd', 200: '#f0d0c4', 300: '#e3b7aa', 400: '#d59a90', 500: '#b96f71', 600: '#93464e', 700: '#71303b', 800: '#4e1b26', 900: '#301019' },
        green: { ...colors.green, 900: '#301019' },
        home: {
          canvas: '#19080d',
          surface: '#3d101a',
          raised: '#55212b',
          line: '#704049',
          control: '#98656a',
          text: '#f6ded3',
          muted: '#cfaea5',
          accent: '#d5a69a',
          'accent-hover': '#ebc6b9',
          'action-ink': '#40131b',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        home: ['DM Sans', 'system-ui', 'sans-serif'],
        editorial: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
