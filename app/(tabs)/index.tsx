import { View, Text, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Memex</Text>
      <Text style={styles.subtitle}>Your personal knowledge management app is ready!</Text>
      <Text style={styles.instructions}>
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#007AFF',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 30,
    textAlign: 'center',
    color: '#666',
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
    lineHeight: 24,
  },
});