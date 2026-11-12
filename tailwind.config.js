/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        border: token('border'),
        text: token('text'),
        muted: token('text-muted'),
        green: { DEFAULT: token('green'), strong: token('green-strong'), soft: token('green-soft') },
        blue: { DEFAULT: token('blue'), soft: token('blue-soft') },
        black: token('black'),
        amber: { DEFAULT: token('amber'), soft: token('amber-soft') },
        red: { DEFAULT: token('red'), soft: token('red-soft') },
        white: '#FFFFFF',
        food: token('acc-food'),
        workout: token('acc-workout'),
        learning: token('acc-learning'),
        finance: token('acc-finance'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        title: ['28px', { lineHeight: '34px', fontWeight: '700' }],
        card: ['20px', { lineHeight: '26px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px' }],
        caption: ['13px', { lineHeight: '18px', fontWeight: '500' }],
      },
      borderRadius: { card: '16px' },
      boxShadow: { soft: '0 8px 24px rgba(10,10,10,0.08)' },
      transitionTimingFunction: { out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    },
  },
  plugins: [],
};
