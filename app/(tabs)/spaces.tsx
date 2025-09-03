import { View, Text, StyleSheet } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../src/stores/theme';

const SpacesScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Text style={[styles.title, isDarkMode && styles.titleDark]}>Spaces</Text>
      <Text style={[styles.description, isDarkMode && styles.descriptionDark]}>
        Organize your items into spaces/projects.
        Coming soon: space cards grid and management.
      </Text>
    </View>
  );
});

export default SpacesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000',
  },
  titleDark: {
    color: '#ffffff',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
  descriptionDark: {
    color: '#AAA',
  },
});
