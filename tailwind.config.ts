import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        arabic: ['var(--font-arabic)', 'Tajawal', 'sans-serif']
      },
      // Tajawal (the only font this app loads) has no 600 weight — Tailwind's default
      // `font-semibold` maps to 600, which would silently fall back to the browser's nearest
      // guess for every one of the 70+ uses across the app. Point it at 500, a weight the
      // font actually ships, so every "semibold" element renders the real loaded font file.
      fontWeight: {
        semibold: '500'
      },
      colors: {
        // Dark-first palette (awwwards/primesec-inspired): 50 = deepest bg, 900 = brightest text.
        // Values come from CSS custom properties (see globals.css :root) so the admin shell can
        // scope a light-mode override under [data-admin-theme="light"] without this config, or
        // the rest of the (deliberately dark-only) app, ever changing.
        ink: {
          50: 'var(--ink-50)',
          100: 'var(--ink-100)',
          200: 'var(--ink-200)',
          300: 'var(--ink-300)',
          400: 'var(--ink-400)',
          500: 'var(--ink-500)',
          600: 'var(--ink-600)',
          700: 'var(--ink-700)',
          800: 'var(--ink-800)',
          900: 'var(--ink-900)'
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)'
        },
        accent: {
          50: 'var(--accent-50)',
          100: 'var(--accent-100)',
          200: 'var(--accent-200)',
          300: 'var(--accent-300)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
          700: 'var(--accent-700)'
        }
      },
      boxShadow: {
        card: '0 1px 1px rgba(0,0,0,0.3), 0 12px 32px -12px rgba(0,0,0,0.6)',
        glass: '0 4px 30px rgba(0, 0, 0, 0.35)',
        glow: '0 0 60px -10px rgba(255,59,76,0.35)'
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
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        'ping-slow': {
          '0%': { transform: 'translateY(-50%) scale(1)', opacity: '1' },
          '75%, 100%': { transform: 'translateY(-50%) scale(2.4)', opacity: '0' }
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        shimmer: 'shimmer 2s linear infinite',
        float: 'float 3.6s ease-in-out infinite',
        'ping-slow': 'ping-slow 2s cubic-bezier(0,0,0.2,1) infinite',
        'spin-slow': 'spin-slow 16s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
