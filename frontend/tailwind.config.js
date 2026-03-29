export default {
  content: ['./index.html','./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Share Tech Mono"','monospace'],
        body:    ['"DM Sans"','system-ui','sans-serif'],
      },
      colors: {
        shadow: {
          void:    '#04060f',
          deep:    '#080c1a',
          panel:   '#0c1226',
          border:  '#1a2340',
          accent:  '#00e5ff',
          warn:    '#ff6b00',
          danger:  '#ff1744',
          ok:      '#00e676',
          purple:  '#7c4dff',
          gold:    '#ffd600',
        }
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan':        'scan 4s linear infinite',
        'blink':       'blink 1s step-end infinite',
        'slide-in-up': 'slideInUp 0.4s ease-out',
      },
      keyframes: {
        scan:      { '0%': { transform:'translateY(-100%)' }, '100%': { transform:'translateY(100%)' } },
        blink:     { '0%,100%': { opacity:1 }, '50%': { opacity:0 } },
        slideInUp: { '0%': { opacity:0, transform:'translateY(16px)' }, '100%': { opacity:1, transform:'translateY(0)' } },
      },
      boxShadow: {
        'neon-cyan':   '0 0 20px rgba(0,229,255,0.3), 0 0 60px rgba(0,229,255,0.1)',
        'neon-red':    '0 0 20px rgba(255,23,68,0.4)',
        'neon-green':  '0 0 20px rgba(0,230,118,0.3)',
        'panel':       '0 4px 32px rgba(0,0,0,0.6)',
      }
    }
  },
  plugins: [],
}
