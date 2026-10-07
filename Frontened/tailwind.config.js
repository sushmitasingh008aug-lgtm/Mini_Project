/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bharat Rail Operations — Saffron Control Theme
        railSaffron: '#FF9933',
        railSaffronDark: '#D96F13',
        railSaffronLight: '#FFF3E6',
        railSaffronWarm: '#FFF9F2',
        surface: '#FFFFFF',
        surfaceWarm: '#FFF9F2',
        canvas: '#F7F7F5',
        canvasMuted: '#F1F5F9',
        borderDefault: '#E6E6E6',
        borderStrong: '#CBD5E1',
        charcoal: '#1F2937',
        textSecondary: '#667085',
        textMuted: '#94A3B8',

        // Semantic Operational Colours
        critRed: '#D92D20',
        critRedSoft: '#FEE4E2',
        critRedBorder: '#FDA29B',
        warnAmber: '#F79009',
        warnAmberSoft: '#FEF0C7',
        warnAmberBorder: '#FEC84B',
        okGreen: '#12B76A',
        okGreenSoft: '#D1FADF',
        okGreenBorder: '#A6F4C5',
        infoBlue: '#2563EB',
        infoBlueSoft: '#EFF8FF',
        infoBlueBorder: '#B2DDFF',
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'saffron': '0 4px 14px 0 rgba(255, 153, 51, 0.25)',
      },
      borderRadius: {
        'card': '14px',
      }
    },
  },
  plugins: [],
}
