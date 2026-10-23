import type { Config } from "tailwindcss";

const config: Config = {
  // The iOS app uses a light design. Do not mix system-dark web utilities
  // with its light cards, labels and native form controls.
  darkMode: process.env.NEXT_PUBLIC_IOS_EMBEDDED === "1"
    ? ["selector", '[data-vta-appearance="dark"]']
    : "media",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef8ff",
          100: "#d8efff",
          600: "#0867b6",
          700: "#07528f"
        }
      }
    }
  },
  plugins: []
};

export default config;
