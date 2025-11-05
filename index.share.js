// Share extension entry point

// Import polyfills first (required for URL parsing and other features)
import 'event-target-polyfill';
import 'web-streams-polyfill';
import 'text-encoding-polyfill';

// Import base64 before URL polyfill
import { decode, encode } from 'base-64';

// Setup base64 encoding/decoding
if (!global.btoa) {
  global.btoa = encode;
}

if (!global.atob) {
  global.atob = decode;
}

// Import URL polyfill after base64 is set up
import 'react-native-url-polyfill/auto';

import { AppRegistry } from "react-native";

// Wrap component import in try-catch to help debug
let ShareExtension;
try {
  ShareExtension = require("./src/components/ShareExtension").default;
} catch (error) {
  console.error('[ShareExtension] Failed to load component:', error);
  // Create a fallback component that shows the error
  const { View, Text, StyleSheet } = require('react-native');
  const { close } = require('expo-share-extension');

  ShareExtension = (props) => {
    const React = require('react');
    return React.createElement(
      View,
      { style: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 } },
      [
        React.createElement(Text, { key: 'error', style: { color: 'red', marginBottom: 20 } },
          'Failed to load: ' + (error?.message || 'Unknown error')
        ),
        React.createElement(Text, { key: 'close', style: { color: 'blue' }, onPress: close },
          'Close'
        )
      ]
    );
  };
}

// IMPORTANT: The first argument must be "shareExtension" (required by expo-share-extension)
AppRegistry.registerComponent("shareExtension", () => ShareExtension);