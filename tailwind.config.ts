import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        panel: "#111a2e",
        panel2: "#16223c",
        line: "#243350",
        muted: "#8ea1c0",
        brand: "#2ca01c",
        brand2: "#1f7a15",
        warn: "#f59e0b",
        danger: "#ef4444",
        ok: "#22c55e",
      },
    },
  },
  plugins: [],
};

export default config;
