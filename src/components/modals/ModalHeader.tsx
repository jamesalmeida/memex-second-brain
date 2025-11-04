import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  isDarkMode: boolean;
}

/**
 * Reusable modal header component with title, optional subtitle,
 * optional back button, and close button.
 */
const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  onClose,
  showBackButton = false,
  onBack,
  isDarkMode,
}) => {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {showBackButton && onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#3A3A3C'}
              />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            {title}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcons
            name="close"
            size={22}
            color={isDarkMode ? '#FFFFFF' : '#3A3A3C'}
          />
        </TouchableOpacity>
      </View>
      {subtitle && (
        <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
          {subtitle}
        </Text>
      )}
    </>
  );
};

export default ModalHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    marginRight: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3A3A3C',
    letterSpacing: 0.5,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    marginTop: -8,
  },
  subtitleDark: {
    color: '#A1A1A6',
  },
});
