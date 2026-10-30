import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./i18n/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        soil: {
          primary: "#2A7C13",
          primaryHover: "#23660f",
          primaryLight: "#e9f6e5",
          secondary: "#76C457",
          secondaryHover: "#62a845",
          cream: "#FFF8CF",
          creamMuted: "#fffdec",
          beige: "#FBE6C2",
          beigeDark: "#e8cba0",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#fbfcf9",
          muted: "#f4f6f0",
          border: "#e2e8df",
          borderStrong: "#c4d1be",
        },
        text: {
          main: "#1c2b18",
          muted: "#556b50",
          light: "#7b8f77",
          inverted: "#ffffff",
        }
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "sans-serif",
        ],
      },
      boxShadow: {
        subtle: "0 1px 3px rgba(42, 124, 19, 0.08), 0 1px 2px rgba(0,0,0,0.04)",
        card: "0 4px 12px rgba(42, 124, 19, 0.06), 0 1px 3px rgba(0,0,0,0.04)",
        hover: "0 8px 24px rgba(42, 124, 19, 0.12), 0 2px 6px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
