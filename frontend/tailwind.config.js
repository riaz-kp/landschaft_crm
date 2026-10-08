/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Landschaft — landscaping company; a green-forward, earthy palette
        brand: {
          50: '#f1f8f3', 100: '#ddeee1', 200: '#bcddc6', 300: '#8fc4a1',
          400: '#5da477', 500: '#3d8659', 600: '#2d6b46', 700: '#25553a',
          800: '#204430', 900: '#1b3829', 950: '#0d1f16',
        },
        clay: {
          50: '#faf6f2', 100: '#f2e9df', 200: '#e4d1bd', 300: '#d2b394',
          400: '#bf906a', 500: '#b1774f', 600: '#a36243', 700: '#874d39',
          800: '#6e4033', 900: '#5a362c', 950: '#301b16',
        },
        canvas: '#f5f6f2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
               'Noto Sans Malayalam', 'Helvetica Neue', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.04), 0 1px 3px rgba(28, 25, 23, 0.06)',
        lift: '0 10px 30px -12px rgba(27, 56, 41, 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
}
