import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextStyle, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import * as Haptics from 'expo-haptics';
import InlineEditableText from '../../InlineEditableText';

interface ItemViewHeaderProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  onClose: () => void;
  isDarkMode: boolean;
  placeholder?: string;
  style?: TextStyle;
}

const ItemViewHeader: React.FC<ItemViewHeaderProps> = ({
  value,
  onSave,
  onClose,
  isDarkMode,
  placeholder = 'Title',
  style,
}) => {
  const handleMenuAction = (action: string) => {
    // Placeholder for future menu actions
    console.log('Menu action:', action);
  };

  // Define placeholder color based on theme
  const placeholderColor = isDarkMode ? '#666666' : '#999999';

  return (
    <View style={[styles.header, isDarkMode && styles.headerDark]}>
      {/* Left: Close button */}
      <TouchableOpacity
        onPress={onClose}
        style={styles.iconButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="chevron-down"
          size={28}
          color={isDarkMode ? '#FFFFFF' : '#000000'}
        />
      </TouchableOpacity>

      {/* Center: Editable title */}
      <View style={styles.titleContainer}>
        <InlineEditableText
          value={value}
          placeholder={placeholder}
          onSave={onSave}
          style={[styles.title, isDarkMode && styles.titleDark, style]}
          isDarkMode={isDarkMode}
          numberOfLines={1}
          ellipsizeMode="tail"
          hideEditIcon={true}
          placeholderTextColor={placeholderColor}
        />
      </View>

      {/* Right: Menu button */}
      <Host>
        <ContextMenu>
          <ContextMenu.Trigger>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
          </ContextMenu.Trigger>
          <ContextMenu.Items>
            <Button onPress={() => handleMenuAction('action1')}>
              Admin Settings
            </Button>
            <Button onPress={() => handleMenuAction('action2')}>
              This is the wrong content type for this item
            </Button>
            {/* (Add Image should only be visible if no image exists) */}
            <Button onPress={() => handleMenuAction('action3')}>
              Add Image 
            </Button>
            <Button onPress={() => handleMenuAction('action4')}>
              Move to Space
            </Button>
            <Button onPress={() => handleMenuAction('action3')}>
              Refresh Item
            </Button> 
            <Button onPress={() => handleMenuAction('action4')}>
              Share Item
            </Button>
            <Button onPress={() => handleMenuAction('action5')}>
              Archive Item
            </Button>
            <Button onPress={() => handleMenuAction('action6')}>
              Unarchive Item
            </Button>
            <Button onPress={() => handleMenuAction('action9')}>
              Delete Item
            </Button>
          </ContextMenu.Items>
        </ContextMenu>
      </Host>
    </View>
  );
};

export default ItemViewHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    // paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    // borderBottomWidth: 0,
    // borderBottomColor: '#E5E5E5',
    ...Platform.select({
      ios: {
        paddingTop: 0,
      },
      android: {
        paddingTop: 0,
      },
    }),
  },
  headerDark: {
    backgroundColor: '#1C1C1E',
    borderBottomColor: '#2C2C2E',
  },
  iconButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    width: '100%',
  },
  titleDark: {
    color: '#FFFFFF',
  },
});
