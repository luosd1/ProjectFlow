import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        paper: "#f7f8f3",
        moss: "#2f6f5e",
        citron: "#d6e645",
        coral: "#dc6a4d",
        harbor: "#2d6f9f",
      },
      boxShadow: {
        panel: "0 16px 50px rgba(31, 41, 51, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
