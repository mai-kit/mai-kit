import { readdir, readFile, writeFile } from "node:fs/promises";
import { defineConfig } from "tsdown";

const BADGE_DIRECTORIES = ["rank", "bonus", "course_rank", "class_rank", "dx_score"] as const;

async function writeBadgeManifest(): Promise<void> {
  const entries = (
    await Promise.all(
      BADGE_DIRECTORIES.map(async (directory) => {
        const source = new URL(`./assets/${directory}/`, import.meta.url);
        const files = (await readdir(source)).filter((file) => file.endsWith(".png")).sort();
        return Promise.all(
          files.map(async (file): Promise<[string, string]> => {
            const bytes = await readFile(new URL(file, source));
            const name = file.slice(0, -".png".length);
            return [`${directory}/${name}`, `data:image/png;base64,${bytes.toString("base64")}`];
          }),
        );
      }),
    )
  ).flat();
  entries.sort(([a], [b]) => a.localeCompare(b));
  await writeFile(
    new URL("./dist/badges.json", import.meta.url),
    `${JSON.stringify(Object.fromEntries(entries))}\n`,
    "utf8",
  );
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2023",
  exports: true,
  fixedExtension: false,
  hash: false,
  sourcemap: false,
  clean: true,
  dts: {
    sourcemap: false,
  },
  hooks: {
    "build:done": writeBadgeManifest,
  },
});
