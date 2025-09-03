import { View, Text, StyleSheet } from 'react-native';

export default function SpacesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spaces</Text>
      <Text style={styles.description}>
        Organize your items into spaces/projects.
        Coming soon: space cards grid and management.
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
});
