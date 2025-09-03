import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { auth } from '../../src/services/supabase';
import { COLORS, UI } from '../../src/constants';

export default function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        console.log('🔍 Starting sign up...');
        const { error } = await auth.signUp(email.trim(), password);
        
        if (error) {
          console.error('❌ Sign up error:', error);
          Alert.alert('Sign Up Error', error.message);
        } else {
          Alert.alert(
            'Account Created!', 
            'Please check your email to verify your account.',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          );
        }
      } else {
        console.log('🔍 Starting sign in...');
        const { error } = await auth.signIn(email.trim(), password);
        
        if (error) {
          console.error('❌ Sign in error:', error);
          Alert.alert('Sign In Error', error.message);
        } else {
          console.log('✅ Sign in successful');
        }
      }
    } catch (error) {
      console.error('❌ Auth exception:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <MaterialIcons name="library-books" size={80} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Welcome to Memex</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create your account' : 'Sign in to your account'}
        </Text>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="email" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <MaterialIcons name="lock" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.authButton, isLoading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={isLoading}
          >
            <Text style={styles.switchButtonText}>
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.light,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: UI.SPACING.lg,
    paddingVertical: UI.SPACING.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: UI.SPACING.sm,
    color: COLORS.text.light,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: UI.SPACING.xl,
    color: '#666',
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: UI.SPACING.md,
    color: COLORS.text.light,
  },
  subtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: UI.SPACING.xl,
    color: '#666',
    lineHeight: 20,
  },
  form: {
    marginBottom: UI.SPACING.xl,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: UI.BORDER_RADIUS,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  authButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: UI.BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: UI.SPACING.sm,
    color: COLORS.text.light,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: UI.BORDER_RADIUS,
    padding: UI.SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: UI.SPACING.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: UI.SPACING.sm,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: UI.BORDER_RADIUS,
    padding: UI.SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: UI.SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: UI.SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border.light,
  },
  dividerText: {
    paddingHorizontal: UI.SPACING.md,
    color: '#666',
    fontSize: 14,
  },
  retryButton: {
    marginTop: UI.SPACING.lg,
  },
  retryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    textAlign: 'center',
  },
  terms: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    lineHeight: 18,
  },
});
