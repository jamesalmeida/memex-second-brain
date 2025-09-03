import { View, Text, StyleSheet } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../src/stores/theme';

const HomeScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Text style={[styles.title, isDarkMode && styles.titleDark]}>Welcome to Memex</Text>
      <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>Your personal knowledge management app is ready!</Text>
      <Text style={[styles.instructions, isDarkMode && styles.instructionsDark]}>
        🎉 **Setup Complete!**
        {"\n"}
        {"\n"}✅ Database schema imported
        {"\n"}✅ Authentication configured
        {"\n"}✅ App structure ready
        {"\n"}
        {"\n"}**Next:** Build the core features!
      </Text>
    </View>
  );
});

export default HomeScreen;

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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#007AFF',
  },
  titleDark: {
    color: '#4BA3FF',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
    color: '#666',
  },
  subtitleDark: {
    color: '#AAA',
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    lineHeight: 24,
  },
  instructionsDark: {
    color: '#CCC',
  },
});