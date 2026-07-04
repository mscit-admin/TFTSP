/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  // Tailwind reads the document `dir` attribute; logical utilities (ps-/pe-/ms-/me-/start-/end-)
  // are used across the app so layout mirrors automatically on RTL/LTR switch.
  theme: {
    extend: {
      colors: {
        // Overridable at runtime from tribe settings (CSS var --tribe-primary).
        tribe: 'var(--tribe-primary, #0f766e)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    // PrimeNG ships its own preflight-like reset via themes; keep Tailwind preflight
    // but it plays fine with PrimeNG v21 styled mode.
    preflight: true,
  },
};
