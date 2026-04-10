import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1B2A4A', light: '#2d3f63', 50: '#E8ECF2' },
        teal: { DEFAULT: '#2E8B8B', bright: '#35a3a3', light: '#3ba8a8', bg: '#eaf5f5', subtle: '#f0fafa' },
        surface: { DEFAULT: '#ffffff', raised: '#f8fafc', hover: '#f1f5f9' },
        status: {
          green: { DEFAULT: '#059669', bg: '#ecfdf5' },
          amber: { DEFAULT: '#d97706', bg: '#fffbeb' },
          red: { DEFAULT: '#dc2626', bg: '#fef2f2' },
          purple: { DEFAULT: '#7c3aed', bg: '#f5f3ff' },
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
};
export default config;
