/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        canvas: '#ffffff',
        panel: '#f8fafc',
        'panel-raised': '#f1f5f9',
        hairline: '#e2e8f0',
        'hairline-strong': '#cbd5e1',

        // Text
        ink: '#0f172a',
        'ink-muted': '#475569',
        'ink-faint': '#94a3b8',

        // Water / hydrology accent (primary)
        water: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          300: '#7dd3fc',
          500: '#0284c7',
          600: '#026aa1',
          700: '#0c4a6e',
        },

        // Risk / severity scale (drives inundation depth coloring)
        risk: {
          normal: '#059669',   // 0-10cm
          caution: '#d97706',  // 10-25cm
          critical: '#dc2626', // >25cm
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '4px',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};
