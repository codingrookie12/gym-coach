import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: "#141414",
        border: "#1F1F1F",
        accent: "#C8F135",
      },
      fontFamily: {
        mono: ["DM Mono", "monospace"],
        sans: ["Syne", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
