/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Keep existing class names, but switch to warmer typography.
        // `font-typewriter` becomes a soft editorial serif for headings.
        'typewriter': ['Fraunces', 'Iowan Old Style', 'Palatino', 'Palatino Linotype', 'Georgia', 'ui-serif', 'serif'],
        // `font-mono` becomes a friendly, readable sans for body copy.
        'mono': ['"Source Sans 3"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        antique: {
          50: '#faf5eb',
          100: '#f5f0e6',
          200: '#e8ddd0',
          300: '#d4c4a8',
          400: '#b89d7a',
          500: '#8b7355',
          600: '#6b5a42',
          700: '#4a3d2e',
          800: '#2f251a',
          900: '#1a140d',
        },
        parchment: {
          light: '#faf5eb',
          DEFAULT: '#f5f0e6',
          dark: '#e8ddd0',
        },
        sepia: {
          light: '#d4c4a8',
          DEFAULT: '#b89d7a',
          dark: '#8b7355',
        },
      },
    },
  },
  plugins: [],
}
