import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        cyber: "#2dd4bf",
        violet: "#8b5cf6",
        danger: "#fb7185"
      },
      boxShadow: {
        glow: "0 20px 80px rgba(45, 212, 191, 0.18)"
      }
    }
  },
  plugins: [require("@tailwindcss/forms")]
};

export default config;
