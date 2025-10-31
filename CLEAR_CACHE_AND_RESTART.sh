#!/bin/bash

# ========================================
# Clear Metro Bundler Cache and Restart
# ========================================
# Use this after deleting files or making major code changes

echo "🧹 Clearing Metro bundler cache..."

# Clear watchman cache
watchman watch-del-all 2>/dev/null || echo "⚠️  Watchman not installed (optional)"

# Clear Metro bundler cache
rm -rf /tmp/metro-* /tmp/haste-* 2>/dev/null
rm -rf $TMPDIR/metro-* $TMPDIR/haste-* 2>/dev/null
rm -rf $TMPDIR/react-* 2>/dev/null

# Clear node_modules cache
rm -rf node_modules/.cache 2>/dev/null

# Clear React Native cache
rm -rf /tmp/react-native-packager-cache-* 2>/dev/null
rm -rf /tmp/metro-bundler-cache-* 2>/dev/null

echo "✅ Cache cleared!"
echo ""
echo "Now run:"
echo "  npx expo start --clear"
echo ""
echo "Or for iOS:"
echo "  npx expo run:ios"
