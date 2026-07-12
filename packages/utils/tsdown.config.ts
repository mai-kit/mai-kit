import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    judgement: "src/judgement.ts",
    song: "src/song.ts",
  },
  format: ["esm"],
  target: "es2023",
  fixedExtension: false,
  hash: false,
  sourcemap: false,
  clean: true,
  dts: {
    sourcemap: false,
  },
});
