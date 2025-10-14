/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4b5055",   // ink
          ink: "#4b5055",
          100: "#f0f0f0",
          300: "#cdcdcd",
        },
      },
      fontFamily: {
        brand: ['"Neue Haas Grotesk Display"', 'system-ui', 'sans-serif'],
      },
      borderColor: {
        brand: "#cdcdcd",
      },
    },
  },
  plugins: [],
}
