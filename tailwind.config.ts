import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        arabic: ['var(--font-arabic)', 'Tajawal', 'sans-serif']
      },
      colors: {
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          400: '#8a8a92',
          600: '#4a4a52',
          800: '#232329',
          900: '#141417'
        },
        accent: {
          50: '#fdf2f2',
          100: '#fbe1e1',
          300: '#ef9a9a',
          500: '#e13a3a',
          600: '#c62e2e',
          700: '#a52424'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,23,0.04), 0 8px 24px -8px rgba(20,20,23,0.10)',
        glass: '0 4px 30px rgba(0, 0, 0, 0.06)'
      },
      borderRadius: {
        xl2: '1.25rem'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        shimmer: 'shimmer 2s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
