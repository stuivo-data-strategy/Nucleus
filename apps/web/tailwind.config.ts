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
        navy: { DEFAULT: '#000053', light: '#00007a', 50: '#e8e8f5' },
        mint: { DEFAULT: '#6cffc6', bright: '#5ae8b0', dark: '#00c98a', bg: '#e8fff5', subtle: '#f0fffb' },
        teal: { DEFAULT: '#6cffc6', bright: '#5ae8b0', light: '#7affd0', bg: '#e8fff5', subtle: '#f0fffb' },
        surface: { DEFAULT: '#ffffff', raised: '#f8fafc', hover: '#f1f5f9' },
        status: {
          green: { DEFAULT: '#059669', bg: '#ecfdf5' },
          amber: { DEFAULT: '#d97706', bg: '#fffbeb' },
          red: { DEFAULT: '#dc2626', bg: '#fef2f2' },
          purple: { DEFAULT: '#7c3aed', bg: '#f5f3ff' },
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
};
export default config;
