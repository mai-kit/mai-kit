const packageDist = (path: string) =>
  new URL(`../../packages/${path}/dist/index.js`, import.meta.url).pathname;

export default {
  build: {
    target: "es2023",
  },
  resolve: {
    alias: [
      {
        find: /^@mai-kit\/utils\/judgement$/u,
        replacement: new URL("../../packages/utils/dist/judgement.js", import.meta.url).pathname,
      },
      {
        find: /^@mai-kit\/utils\/song$/u,
        replacement: new URL("../../packages/utils/dist/song.js", import.meta.url).pathname,
      },
      { find: /^@mai-kit\/shared$/u, replacement: packageDist("shared") },
      { find: /^@mai-kit\/utils$/u, replacement: packageDist("utils") },
      { find: /^@mai-kit\/assets$/u, replacement: packageDist("assets") },
      { find: /^@mai-kit\/database$/u, replacement: packageDist("database") },
      { find: /^@mai-kit\/prober$/u, replacement: packageDist("prober") },
      { find: /^@mai-kit\/analysis$/u, replacement: packageDist("analysis") },
    ],
  },
};
