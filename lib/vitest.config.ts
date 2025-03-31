import { defineConfig } from "vite";

export default defineConfig({
  test: {
    include: ["out\/**\/*.{test,spec}.?(c|m)[jt]s?(x)"],
    coverage: {
      exclude: ["test*", "**/*.{test,config}.{js,ts}", "**/namespace.{js,ts}", "benchmarks/*", "types/*"],
      provider: "v8"
    },
    reporters: ["verbose"]
  },
})