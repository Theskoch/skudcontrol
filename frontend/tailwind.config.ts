import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: "#0d0d0d",
        surface: "#1a1a19",
        "surface-raised": "#232326",
        ink: {
          primary: "#ffffff",
          secondary: "#c3c2b7",
          muted: "#898781",
        },
        line: {
          hairline: "#2c2c2a",
          baseline: "#383835",
        },
        accent: {
          violet: "#9085e9",
          "violet-strong": "#7c6ee8",
          yellow: "#c98500",
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          critical: "#d03b3b",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      fontVariantNumeric: {
        tabular: "tabular-nums",
      },
    },
  },
  plugins: [],
} satisfies Config;
