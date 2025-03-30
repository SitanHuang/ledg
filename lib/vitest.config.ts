import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["out\/**\/*.{test,spec}.?(c|m)[jt]s?(x)"],
    reporters: ["verbose"]
  },
})