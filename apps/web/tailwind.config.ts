import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#09090B',
          900: '#111115',
          850: '#17171C',
          800: '#1F1F27',
          700: '#2C2C38',
        },
        amber: {
          300: '#FCD34D',
          400: '#F5B041',
          500: '#E59819',
          600: '#C2780A',
        },
        crimson: {
          500: '#E11D48',
          600: '#BE123C',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;

