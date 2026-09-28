import * as path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  root: __dirname,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setupTests.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["src/test/manual/**/*.manual.test.{ts,tsx}"],
    passWithNoTests: true,
    reporters: ["default", "junit", "html"],
    outputFile: {
      junit: "test-results/junit.xml",
      html: "test-results/report.html"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      exclude: ["**/index.ts", "**/types.ts", "src/test/setupTests.ts"],
    },
    css: true,
  },
  resolve: {
    alias: {
      "@hooks": path.resolve(__dirname, "src/app/renderer/components/hooks"),
      "@parts": path.resolve(__dirname, "src/app/renderer/components/parts"),
      "@templates": path.resolve(
        __dirname,
        "src/app/renderer/components/templates",
      ),
      "@ui": path.resolve(__dirname, "src/app/renderer/components/ui"),
      "@api": path.resolve(__dirname, "src/app/renderer/api"),
      "@assets": path.resolve(__dirname, "src/app/renderer/assets"),
      "@styles": path.resolve(__dirname, "src/app/renderer/styles"),
      "@components": path.resolve(__dirname, "src/app/renderer/components"),
      "@stores": path.resolve(__dirname, "src/app/renderer/stores"),
      "@types": path.resolve(__dirname, "src/app/renderer/types"),
      "@views": path.resolve(__dirname, "src/app/renderer/views"),  
      "@renderer": path.resolve(__dirname, "src/app/renderer"),    
      "@resources": path.resolve(__dirname, "resources"),
      "@main": path.resolve(__dirname, "src/app/main"),
      "@shared": path.resolve(__dirname, "src/app/shared"),
    },
  },
  optimizeDeps: {
    include: ["quill", "Quill"],
  },
});
