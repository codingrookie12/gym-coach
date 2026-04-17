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
        bg:       "#0C0B09",
        surface:  "#131210",
        "surface-2": "#1A1916",
        border:   "#252320",
        "border-2": "#2E2B27",
        accent:   "#D4F13A",
        rust:     "#E8633A",
      },
      fontFamily: {
        display: ["Bebas Neue", "sans-serif"],
        mono:    ["Space Mono", "monospace"],
        sans:    ["Barlow Condensed", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
