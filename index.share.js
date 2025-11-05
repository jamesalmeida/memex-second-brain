// Share extension entry point
import { AppRegistry } from "react-native";
import ShareExtension from "./src/components/ShareExtension";

// IMPORTANT: The first argument must be "shareExtension" (required by expo-share-extension)
AppRegistry.registerComponent("shareExtension", () => ShareExtension);