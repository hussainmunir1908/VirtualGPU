/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        g: {
          bg: 'var(--bg)', surface: 'var(--surface)', raised: 'var(--raised)',
          border: 'var(--border)', text: 'var(--text)', muted: 'var(--muted)',
          dim: 'var(--dim)', accent: 'var(--accent)', green: 'var(--green)',
          amber: 'var(--amber)', red: 'var(--red)', blue: 'var(--blue)', purple: 'var(--purple)',
        },
        neu: {
          bg: 'var(--bg)', surface: 'var(--surface)', raised: 'var(--raised)',
          border: 'var(--border)', text: 'var(--text)', muted: 'var(--muted)',
          dim: 'var(--dim)', active: 'var(--accent)', blue: 'var(--blue)',
          amber: 'var(--amber)', red: 'var(--red)', purple: 'var(--purple)',
          pink: '#8A4868', green: 'var(--green)',
        },
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'Consolas', 'monospace'],
        serif: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { 'neu': '8px', 'neu-sm': '5px', 'neu-xs': '4px' },
      animation: {
        'pulse-core': 'pulse-core 1.6s ease-in-out infinite',
        'fade-in':    'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-core': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        'fade-in':    { from: { opacity: '0' }, to: { opacity: '1' } },
      },
    },
  },
  plugins: [],
};
