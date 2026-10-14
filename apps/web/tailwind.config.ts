import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0b0f19",
        surface: "#111827",
        "surface-light": "#1e293b",
        primary: "#3b82f6",
        "primary-glow": "#60a5fa",
        accent: "#06b6d4",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["Fira Code", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 25px rgba(59, 130, 246, 0.25)",
        "glow-cyan": "0 0 25px rgba(6, 182, 212, 0.25)",
        "glow-purple": "0 0 25px rgba(147, 51, 234, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
