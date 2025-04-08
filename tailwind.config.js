/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

export default {
  content: ["./client/index.html", "./client/**/*.{jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary, Secondary, Accent, etc. for general use
        primary: colors.blue,
        secondary: colors.gray,
        accent: colors.purple,
        success: colors.green,
        warning: colors.yellow,
        danger: colors.red,
        // Specific Dark mode colors for clarity
        dark: {
          background: '#111827', // gray-900
          surface: '#1f2937',    // gray-800
          "surface-alt": '#374151', // gray-700
          border: '#4b5563',    // gray-600
          text: colors.gray[100], // Brighter text for dark bg
          "text-secondary": colors.gray[400],
        },
        // You can add light mode specific colors too if needed
        light: {
           background: colors.white,
           surface: colors.gray[50],
           border: colors.gray[200],
           text: colors.gray[800],
           "text-secondary": colors.gray[500],
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'], // Simplified mono stack
      },
      // Base typography styles
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.light.text'),
            a: { color: theme('colors.primary.600'), '&:hover': { color: theme('colors.primary.700') }, },
            strong: { color: theme('colors.light.text') },
            code: { 
              backgroundColor: theme('colors.secondary.100'), 
              padding: '0.2em 0.4em', 
              borderRadius: '0.25rem', 
              fontWeight: '400', 
              color: theme('colors.secondary.700'),
              '&::before': { content: 'none !important' }, // Remove quotes
              '&::after': { content: 'none !important' }, // Remove quotes
            },
            pre: { 
              backgroundColor: theme('colors.secondary.100'), 
              color: theme('colors.secondary.700'),
              padding: theme('spacing.4'),
              borderRadius: theme('borderRadius.md'),
            },
            // Add other base styles as needed
          },
        },
        invert: { // Corresponds to .prose-invert used in dark mode
          css: {
            color: theme('colors.dark.text-secondary'),
            a: { color: theme('colors.primary.400'), '&:hover': { color: theme('colors.primary.300') }, },
            strong: { color: theme('colors.dark.text') },
            code: { 
              backgroundColor: theme('colors.dark.surface-alt'), 
              color: theme('colors.dark.text-secondary'),
              // Ensure no quotes here either
              '&::before': { content: 'none !important' }, 
              '&::after': { content: 'none !important' },
            },
            pre: {
              backgroundColor: theme('colors.dark.surface-alt'),
              color: theme('colors.dark.text-secondary'),
            },
            // --- Headings --- 
            h1: { color: theme('colors.dark.text') },
            h2: { color: theme('colors.dark.text') },
            h3: { color: theme('colors.dark.text') },
            h4: { color: theme('colors.dark.text') },
            // --- Blockquotes --- 
            blockquote: {
              color: theme('colors.dark.text-secondary'),
              borderLeftColor: theme('colors.dark.border'),
            },
            // --- Lists --- 
            'ol > li::before': { color: theme('colors.dark.text-secondary') },
            'ul > li::before': { backgroundColor: theme('colors.dark.border') },
            // --- Misc --- 
            hr: { borderColor: theme('colors.dark.border') },
            // ... add other dark typography overrides
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    // Add other plugins like @tailwindcss/forms if needed later
  ],
};
