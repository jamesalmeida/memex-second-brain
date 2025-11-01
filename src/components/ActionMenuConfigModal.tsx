import React, { useCallback, useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { userSettingsComputed, userSettingsActions } from '../stores/userSettings';
import { RadialActionId } from '../types';

interface ActionMenuConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

interface ActionOption {
  id: RadialActionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}

const AVAILABLE_ACTIONS: ActionOption[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: 'chatbubble-outline',
    color: '#007AFF',
    description: 'Open AI chat for this item',
  },
  {
    id: 'share',
    label: 'Share',
    icon: 'share-outline',
    color: '#34C759',
    description: 'Share item URL',
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: 'archive-outline',
    color: '#FF9500',
    description: 'Move to archive',
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'trash-outline',
    color: '#FF3B30',
    description: 'Delete item',
  },
  {
    id: 'move',
    label: 'Move to Space',
    icon: 'folder-outline',
    color: '#AF52DE',
    description: 'Move to a different space',
  },
  {
    id: 'refresh',
    label: 'Refresh',
    icon: 'refresh-outline',
    color: '#5AC8FA',
    description: 'Refresh item metadata',
  },
];

const ActionMenuConfigModal = observer(({
  visible,
  onClose,
}: ActionMenuConfigModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const currentActions = userSettingsComputed.radialActions();
  const [selectedActions, setSelectedActions] = useState<RadialActionId[]>(currentActions);

  // Sync internal state with computed value when it changes
  useEffect(() => {
    setSelectedActions(currentActions);
  }, [currentActions]);

  const handleActionToggle = useCallback((actionId: RadialActionId) => {
    setSelectedActions(prev => {
      const isSelected = prev.includes(actionId);

      if (isSelected) {
        // Deselect: remove from array
        const newActions = prev.filter(id => id !== actionId);
        // Ensure at least 1 action is selected
        if (newActions.length === 0) {
          Alert.alert('Minimum Required', 'You must select at least 1 action');
          return prev;
        }
        return newActions;
      } else {
        // Select: add to array
        const newActions = [...prev, actionId];
        // Ensure no more than 3 actions are selected
        if (newActions.length > 3) {
          Alert.alert('Maximum Reached', 'You can only select up to 3 actions');
          return prev;
        }
        return newActions;
      }
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedActions.length === 0) {
      Alert.alert('Error', 'You must select at least 1 action');
      return;
    }
    if (selectedActions.length > 3) {
      Alert.alert('Error', 'You can only select up to 3 actions');
      return;
    }

    await userSettingsActions.updateSetting('ui_radial_actions', selectedActions);
    onClose();
  }, [selectedActions, onClose]);

  const handleCancel = useCallback(() => {
    setSelectedActions(currentActions);
    onClose();
  }, [currentActions, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleCancel}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalContent, isDarkMode && styles.modalContentDark]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, isDarkMode && styles.titleDark]}>
                Configure Action Menu
              </Text>
              <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color={isDarkMode ? '#FFFFFF' : '#3A3A3C'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
              Select up to 3 actions for the quick action menu
            </Text>

            <ScrollView
              style={styles.actionsList}
              showsVerticalScrollIndicator={false}
            >
              {AVAILABLE_ACTIONS.map((action) => {
                const isSelected = selectedActions.includes(action.id);
                const selectionIndex = selectedActions.indexOf(action.id);

                return (
                  <TouchableOpacity
                    key={action.id}
                    style={[styles.actionItem, isDarkMode && styles.actionItemDark]}
                    onPress={() => handleActionToggle(action.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.actionItemContent}>
                      <View style={[
                        styles.checkbox,
                        isSelected && styles.checkboxSelected,
                        isSelected && { backgroundColor: action.color, borderColor: action.color }
                      ]}>
                        {isSelected && (
                          <MaterialIcons name="check" size={16} color="#FFFFFF" />
                        )}
                      </View>

                      <View style={[
                        styles.iconContainer,
                        { backgroundColor: action.color }
                      ]}>
                        <Ionicons
                          name={action.icon}
                          size={20}
                          color="#FFFFFF"
                        />
                      </View>

                      <View style={styles.actionTextContainer}>
                        <Text style={[styles.actionLabel, isDarkMode && styles.actionLabelDark]}>
                          {action.label}
                        </Text>
                        <Text style={[styles.actionDescription, isDarkMode && styles.actionDescriptionDark]}>
                          {action.description}
                        </Text>
                      </View>

                      {isSelected && (
                        <View style={[styles.orderBadge, { backgroundColor: action.color }]}>
                          <Text style={styles.orderText}>{selectionIndex + 1}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.footer}>
              <Text style={[styles.selectedCount, isDarkMode && styles.selectedCountDark]}>
                {selectedActions.length} / 3 selected
              </Text>
              <View style={styles.footerButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

export default ActionMenuConfigModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
    maxWidth: 420,
    maxHeight: '80%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  modalContentDark: {
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
  },
  subtitleDark: {
    color: '#A1A1A6',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsList: {
    flexShrink: 1,
    marginBottom: 16,
  },
  actionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  actionItemDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderWidth: 0,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 2,
  },
  actionLabelDark: {
    color: '#FFFFFF',
  },
  actionDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  actionDescriptionDark: {
    color: '#A1A1A6',
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  orderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 16,
  },
  selectedCount: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 12,
  },
  selectedCountDark: {
    color: '#A1A1A6',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
