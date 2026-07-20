import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0d5c63",
          dark: "#0a4a50",
          light: "#e6f0f1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
