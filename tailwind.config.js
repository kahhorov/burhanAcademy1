
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0d9488',
          light: '#14b8a6',
          dark: '#0f766e',
        },
        accent: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        dark: {
          bg: '#0a0f1a',
          card: '#111827',
          text: '#e5e7eb',
          border: '#1f2937',
        },
      },
    },
  },
  plugins: [],
};
