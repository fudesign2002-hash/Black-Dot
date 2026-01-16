/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      keyframes: {
        "bounce-happy": {
          "0%": { transform: "translateY(0)" },
          "25%": { transform: "translateY(-4px)" },
          "50%": { transform: "translateY(0)" },
          "75%": { transform: "translateY(-2px)" },
          "100%": { transform: "translateY(0)" }
        }
      },
      animation: {
        "bounce-happy": "bounce-happy 0.6s ease-in-out infinite"
      }
    }
  },
  plugins: []
}
