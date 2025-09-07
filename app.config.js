const IS_DEV = process.env.APP_VARIANT === 'development';

export default {
  expo: {
    name: IS_DEV ? 'Memex (Dev)' : 'Memex: Second Brain',
    slug: 'memex-second-brain',
    version: '0.1.0',
    orientation: 'portrait',
    icon: IS_DEV ? './assets/icon-dev.png' : './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    scheme: 'memex',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? 'com.jamesalmeida.memex.dev' : 'com.jamesalmeida.memex',
      buildNumber: '1'
    },
    android: {
      adaptiveIcon: {
        foregroundImage: IS_DEV ? './assets/adaptive-icon-dev.png' : './assets/adaptive-icon.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: true,
      package: IS_DEV ? 'com.jamesalmeida.memex.dev' : 'com.jamesalmeida.memex',
      versionCode: 1
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-share-extension',
        {
          ios: {
            activationRules: {
              NSExtensionActivationSupportsText: true,
              NSExtensionActivationSupportsWebURLWithMaxCount: 1,
              NSExtensionActivationSupportsImageWithMaxCount: 1,
              NSExtensionActivationSupportsMovieWithMaxCount: 1,
              NSExtensionActivationSupportsFileWithMaxCount: 1
            },
            groupIdentifier: 'group.com.jamesalmeida.memex'
          }
        }
      ],
      'expo-video',
      'expo-web-browser'
    ]
  }
};