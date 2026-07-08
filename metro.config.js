const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const config = {
  resolver: {
    assetExts: [...assetExts, 'gguf', 'bin'],
    sourceExts: sourceExts.filter((ext) => ext !== 'gguf' && ext !== 'bin'),
  },
};

module.exports = mergeConfig(defaultConfig, config);
