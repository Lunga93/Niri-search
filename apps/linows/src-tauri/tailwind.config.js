/** @type {import('tailwindcss').Config} */
export default {
  content: [
    '../src/**/*.{html,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-tint': 'var(--bg-tint)',
        'font-color': 'var(--font-color)',
        'font-secondary': 'var(--font-secondary)',
        'font-muted': 'var(--font-muted)',
        'border-color': 'var(--border-color)',
        'panel-fill': 'var(--panel-fill)',
        'control-fill': 'var(--control-fill)',
        'accent-color': 'var(--accent-color)',
        'on-accent': 'var(--on-accent-color)',
        'success': 'var(--color-success)',
        'warning': 'var(--color-warning)',
        'danger': 'var(--color-danger)',
        'info': 'var(--color-info)',
      },
      borderRadius: {
        'card': '12px',
        'control': '12px',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
        'mono': ['SF Mono', 'Cascadia Code', 'JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
