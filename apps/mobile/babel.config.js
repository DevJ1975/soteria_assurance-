/**
 * Babel configuration for the Soteria Assurance Expo app.
 *
 * - `babel-preset-expo` is the required Expo / React Native preset.
 * - `react-native-reanimated/plugin` MUST be listed last (Reanimated worklets
 *   are transformed by this plugin and it has to run after every other one).
 * - WatermelonDB decorators are enabled so `@field` / `@date` / `@relation`
 *   model decorators compile.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
