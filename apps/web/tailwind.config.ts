import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#0f172a',
          hover: '#1e293b',
          active: '#1d4ed8',
          border: '#1e293b',
          text: '#94a3b8',
          'text-active': '#ffffff',
          heading: '#ffffff',
        },
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
