/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        zvote: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b7cfff",
          300: "#8aaeff",
          400: "#5b86ff",
          500: "#345fff",
          600: "#1b3ff5",
          700: "#152fd1",
          800: "#1729a8",
          900: "#182985",
        },
      },
    },
  },
  plugins: [],
};
