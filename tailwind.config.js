/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./web/templates/**/*.html",
    "./web/static/js/**/*.js",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        hausdog: {
          // Primary: Soft coral/salmon - warm and inviting
          "primary": "#f97066",
          "primary-content": "#ffffff",

          // Secondary: Soft sky blue - calm and trustworthy
          "secondary": "#38bdf8",
          "secondary-content": "#ffffff",

          // Accent: Soft mint green - fresh
          "accent": "#34d399",
          "accent-content": "#ffffff",

          // Neutral: Soft warm gray
          "neutral": "#6b7280",
          "neutral-content": "#ffffff",

          // Base: Clean white with warm off-white backgrounds
          "base-100": "#ffffff",
          "base-200": "#fafafa",
          "base-300": "#f4f4f5",
          "base-content": "#27272a",

          // Status colors - softer versions
          "info": "#60a5fa",
          "info-content": "#ffffff",
          "success": "#4ade80",
          "success-content": "#ffffff",
          "warning": "#fbbf24",
          "warning-content": "#27272a",
          "error": "#f87171",
          "error-content": "#ffffff",

          // Rounded corners - softer
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "0.5rem",

          // Animation
          "--animation-btn": "0.2s",
          "--animation-input": "0.2s",

          // Button styling
          "--btn-focus-scale": "0.98",
          "--border-btn": "1px",
          "--tab-border": "1px",
          "--tab-radius": "0.5rem",
        },
      },
    ],
  },
}
