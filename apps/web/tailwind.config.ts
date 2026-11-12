import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Semantic colors backed by the CSS tokens in src/index.css, so light/dark
      // follow the theme and opacity modifiers work (bg-accent/10, border-line/30).
      colors: {
        canvas: "rgb(var(--bg-primary-rgb) / <alpha-value>)",
        surface: "rgb(var(--bg-secondary-rgb) / <alpha-value>)",
        tertiary: "rgb(var(--bg-tertiary-rgb) / <alpha-value>)",
        line: "rgb(var(--border-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["Consolas", "Fira Code", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
