import React, { ReactNode } from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  DimensionValue,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../../stores/theme';

interface BaseModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  maxHeight?: DimensionValue;
  borderRadius?: number;
  backdropOpacity?: number;
  keyboardAware?: boolean;
}

/**
 * Base modal component that provides consistent backdrop, theme support,
 * and layout for all modals in the app.
 */
const BaseModal = observer(({
  visible,
  onClose,
  children,
  maxWidth = 420,
  maxHeight = '80%',
  borderRadius = 24,
  backdropOpacity = 0.35,
  keyboardAware = false,
}: BaseModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();

  const content = (
    <View style={styles.modalOverlay}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.modalContent,
            isDarkMode && styles.modalContentDark,
            { maxWidth, maxHeight, borderRadius },
          ]}
        >
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );

  if (keyboardAware) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }]}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={onClose}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(event) => event.stopPropagation()}
              style={[
                styles.modalContent,
                isDarkMode && styles.modalContentDark,
                { maxWidth, maxHeight, borderRadius },
              ]}
            >
              {children}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})` }]}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.modalContent,
              isDarkMode && styles.modalContentDark,
              { maxWidth, maxHeight, borderRadius },
            ]}
          >
            {children}
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

export default BaseModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
});
