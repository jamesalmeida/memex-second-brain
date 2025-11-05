const { getDefaultConfig } = require('expo/metro-config');
const { withShareExtension } = require('expo-share-extension/metro');

const config = getDefaultConfig(__dirname);

// Add support for youtubei.js package exports
config.resolver.unstable_enablePackageExports = true;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'd.ts'];

module.exports = withShareExtension(config, {
  // Enable CSS support if needed
  isCSSEnabled: false,
});