/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./.vitepress/**/*.{js,ts,vue}",
    "./*.md",
    "./docs/**/*.md"
  ],
  theme: {
    extend: {
      colors: {
        'scarlett': {
          light: '#DC143C',
          DEFAULT: '#B22222',
          dark: '#8B0000',
          darker: '#660000'
        }
      }
    }
  },
  plugins: []
}
