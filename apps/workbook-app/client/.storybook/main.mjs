import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type { import('@storybook/react-webpack5').StorybookConfig } */
export default {
  stories: [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-react-native-web",
    "@chromatic-com/storybook",
  ],
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
  staticDirs: ["../web", "../public"],
  webpackFinal: async (config) => {
    if (!config.module?.rules) {
      throw new Error("Webpack config is missing module.rules");
    }

    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, ".."),
      "@assets": path.resolve(__dirname, "../assets"),
      "@components": path.resolve(__dirname, "../components"),
      "@functionals": path.resolve(__dirname, "../components/functionals"),
      "@hooks": path.resolve(__dirname, "../components/hooks"),
      "@identities": path.resolve(__dirname, "../components/identities"),
      "@organisms": path.resolve(__dirname, "../components/organisms"),
      "@pages": path.resolve(__dirname, "../components/pages"),
      "@parts": path.resolve(__dirname, "../components/parts"),
      "@views": path.resolve(__dirname, "../components/views"),
      "react-native$": "react-native-web",
      "react-native-svg": "react-native-svg/lib/commonjs/ReactNativeSVG.web",
      "react-native-webview": "react-native-web-webview",
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      tty: false,
    };

    // pnpm isolated can give the React Native Web addon a separate Webpack
    // instance. Recreate only its DefinePlugin objects with Storybook's
    // compiler instance so Webpack's instanceof guard remains valid.
    const compilerDefinePlugin = config.plugins?.find(
      (plugin) => plugin?.constructor?.name === "DefinePlugin",
    )?.constructor;
    if (compilerDefinePlugin) {
      config.plugins = config.plugins.map((plugin) =>
        plugin?.constructor?.name === "DefinePlugin" &&
        !(plugin instanceof compilerDefinePlugin)
          ? new compilerDefinePlugin(plugin.definitions)
          : plugin,
      );
    }

    // The addon supplies the React Native preset itself. Loading the app-level
    // Babel config again would combine it with babel-preset-expo and register
    // two parser overrides for TypeScript files.
    for (const rule of config.module.rules) {
      const usesReactNativePreset = rule?.options?.presets?.some((preset) =>
        JSON.stringify(preset).includes("@react-native/babel-preset"),
      );
      if (usesReactNativePreset) {
        rule.options.babelrc = false;
        rule.options.configFile = false;
      }
    }

    for (const rule of config.module.rules) {
      if (rule && typeof rule === "object" && rule.test?.test?.("file.svg")) {
        rule.exclude = /\.svg$/;
      }
    }
    config.module.rules.push(
      { test: /\.svg$/, use: ["@svgr/webpack"] },
      {
        test: /\.html$/,
        type: "asset/resource",
        generator: { filename: "static/[hash][ext][query]" },
      },
    );

    return config;
  },
};
