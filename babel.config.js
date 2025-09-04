module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@babel/plugin-syntax-import-attributes', {deprecatedAssertSyntax: true}],
      '@babel/plugin-transform-export-namespace-from',
      'react-native-reanimated/plugin',
    ],
  };
};