/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'page-cream': 'var(--color-page-cream)',
        'parchment': 'var(--color-parchment)',
        'library-ink': 'var(--color-library-ink)',
        'yale-blue': 'var(--color-yale-blue)',
        'maple-rust': 'var(--color-maple-rust)',
        'coffee-cream': 'var(--color-coffee-cream)',
        'gilmore-gold': 'var(--color-gilmore-gold)',
        'porch-sage': 'var(--color-porch-sage)',
        'sidebar-bg': 'var(--color-sidebar-bg)',
        'sidebar-text': 'var(--color-sidebar-text)',
        'sidebar-muted': 'var(--color-sidebar-muted)',
        'sidebar-accent': 'var(--color-sidebar-accent)',
      },
      fontFamily: {
        'display': ['"Fraunces"', 'serif'],
        'body': ['"Newsreader"', 'serif'],
        'label': ['"Special Elite"', 'monospace'],
      },
      letterSpacing: {
        'wider-label': '0.18em',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'leaf-fall': {
          '0%': { transform: 'translate3d(0, -10vh, 0) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '0.55' },
          '90%': { opacity: '0.4' },
          '100%': { transform: 'translate3d(24px, 110vh, 0) rotate(200deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.7s ease-out both',
        'leaf-fall': 'leaf-fall linear infinite',
      },
      boxShadow: {
        'cozy': '0 1px 2px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.08), 0 12px 24px -8px rgba(0,0,0,0.15)',
      },
      transitionProperty: {
        'theme': 'background-color, border-color, color',
      },
    },
  },
  plugins: [],
}