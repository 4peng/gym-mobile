// Flat ESLint config for the Expo / React Native app.
// Run with `npm run lint`. Uses Expo's shared config (eslint-config-expo).
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["node_modules/*", "dist/*", ".expo/*", ".expo-export-check/*", "server/*", "assets/*", "*.config.js", "tsconfig.tsbuildinfo"],
  },
  {
    // Colours live in src/constants/theme.ts only. Screens and components use tokens.
    files: ["src/components/**/*.tsx", "src/screens/**/*.tsx", "app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\()/]",
          message: "Use a token from @/constants/theme instead of a raw colour literal.",
        },
        {
          selector: "TemplateElement[value.raw=/^(#[0-9a-fA-F]{3,8}|rgba?\\()/]",
          message: "Use a token from @/constants/theme instead of a raw colour literal.",
        },
      ],
    },
  },
];
