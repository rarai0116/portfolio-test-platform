import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig(({ command, mode }) => {
  const isProdBuild = command === "build" && mode === "prod";
  const sourcemap = !isProdBuild;

  return {
    main: {
      build: {
        externalizeDeps: false,
        sourcemap,
        rollupOptions: {
          external: ["better-sqlite3"],
          input: {
            index: resolve("src/app/main/index.ts"),
            "gb.worker": resolve("src/app/main/ipc/firestore/gb.worker.ts"),
          },
        },
      },
      resolve: {
        alias: {
          "@main": resolve("src/app/main"),
          "@utils": resolve("src/app/main/utils"),
          "@resources": resolve("resources"),
          "@shared": resolve("src/app/shared"),
        },
      },
    },
    preload: {
      build: {
        externalizeDeps: false,
        sourcemap,
        rollupOptions: {
          input: resolve("src/app/preload/index.ts"),
          output: {
            entryFileNames: "index.cjs",
            format: "cjs",
          },
        },
      },
      resolve: {
        alias: {
          "@main": resolve("src/app/main"),
          "@utils": resolve("src/app/main/utils"),
          "@resources": resolve("resources"),
          "@shared": resolve("src/app/shared"),
        },
      },
    },
    renderer: {
      root: resolve("src/app/renderer"),
      build: {
        sourcemap,
        rollupOptions: {
          input: {
            index: resolve("src/app/renderer/index.html"),
            createPdfPreviewWindow: resolve(
              "src/app/renderer/createPdfPreviewWindow.html",
            ),
            difficultyFeasibilityWorker: resolve(
              "src/app/renderer/views/createPdf/api/difficultyFeasibilityWorker.ts",
            ),
            drawWorker: resolve(
              "src/app/renderer/views/createPdf/api/drawWorker.ts",
            ),
          },
        },
        cssCodeSplit: true,
      },
      server: {
        hmr: true,
        host: "0.0.0.0",
        fs: {
          strict: true,
          allow: [
            resolve("."),
            resolve("src"),
            resolve("resources"),
            resolve("../.."),
            resolve("../../node_modules"),
          ],
        },
      },
      assetsInclude: [
        "**/*.png",
        "**/*.jpg",
        "**/*.jpeg",
        "**/*.gif",
        "**/*.svg",
        "**/*.ico",
        "**/*.woff",
        "**/*.woff2",
        "**/*.ttf",
        "**/*.otf",
      ],
      resolve: {
        alias: {
          Quill: resolve("src/app/renderer/api/quillGlobal.ts"),
          "@hooks": resolve("src/app/renderer/components/hooks"),
          "@parts": resolve("src/app/renderer/components/parts"),
          "@templates": resolve("src/app/renderer/components/templates"),
          "@ui": resolve("src/app/renderer/components/ui"),
          "@api": resolve("src/app/renderer/api"),
          "@assets": resolve("src/app/renderer/assets"),
          "@styles": resolve("src/app/renderer/styles"),
          "@components": resolve("src/app/renderer/components"),
          "@stores": resolve("src/app/renderer/stores"),
          "@types": resolve("src/app/renderer/types"),
          "@views": resolve("src/app/renderer/views"),
          "@renderer": resolve("src/app/renderer"),
          "@shared": resolve("src/app/shared"),
          "@": resolve("src/app/renderer"),
        },
      },
      optimizeDeps: {
        exclude: [
          "quill-image-resize-module",
          "quill-resize-module",
        ],
      },
      plugins: [react(), tailwindcss()],
    },
  };
});
