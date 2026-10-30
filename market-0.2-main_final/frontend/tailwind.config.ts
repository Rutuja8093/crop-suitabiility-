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
          forest: "#0B4D2B",          // Deep forest green: sidebar, brand, major headings
          primary: "#176B38",         // Primary section green: buttons, active controls
          primaryHover: "#0E5429",    // Hover state for primary buttons
          primaryLight: "#EAF5EC",    // Pale green icon backgrounds, badges
          leaf: "#43A047",           // Leaf green: positive indicators, accents
          leafHover: "#388E3C",
          cream: "#FFF8CF",
          creamMuted: "#FFFDEC",
          beige: "#FBE6C2",
          beigeDark: "#E8CBA0",
        },
        surface: {
          DEFAULT: "#FFFFFF",         // White cards, panels, tables
          workspace: "#F5F7F3",       // Warm light-grey main background
          subtle: "#F5F7F3",
          muted: "#ECEFEA",
          border: "#E6E9E5",          // Soft border grey
          borderStrong: "#CCD3CB",
        },
        text: {
          main: "#0B4D2B",            // Main headings in dark forest green
          dark: "#1A2E22",            // High-contrast readable body text
          muted: "#4A6B67",           // Muted secondary text and descriptions
          light: "#728B87",           // Subtle captions and placeholders
          inverted: "#FFFFFF",
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
