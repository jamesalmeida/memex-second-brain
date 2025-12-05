import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { themeStore } from '../stores/theme';
import { spacesComputed, spacesActions } from '../stores/spaces';
import { BaseModal, ModalHeader } from './modals';
import { SPECIAL_SPACES } from '../constants';

interface SpacesManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToSpace: (spaceId: string) => void;
  onEditSpace: (spaceId: string) => void;
}

const SpacesManagementModal = observer(({
  visible,
  onClose,
  onNavigateToSpace,
  onEditSpace,
}: SpacesManagementModalProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const spaces = spacesComputed.activeSpaces();

  const navigateToSpace = (spaceId: string) => {
    console.log('🚪 [SpacesManagementModal] Navigate to space:', spaceId);
    onNavigateToSpace(spaceId);
    onClose();
  };

  const handleEditSpace = (spaceId: string) => {
    console.log('📝 Edit space:', spaceId);
    onEditSpace(spaceId);
    onClose();
  };

  const handleArchiveSpace = async (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    // Check if space has items
    const { itemsStore } = await import('../stores/items');
    const items = itemsStore.items.get();
    const itemsInSpace = items.filter(item => item.space_id === spaceId && !item.is_deleted);
    const itemCount = itemsInSpace.length;

    const message = itemCount === 0
      ? `Archive "${space.name}"?`
      : `Archive "${space.name}"? This will also archive all ${itemCount} item${itemCount !== 1 ? 's' : ''} inside.`;

    Alert.alert(
      'Archive Space',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Archive',
          onPress: async () => {
            try {
              await spacesActions.archiveSpaceWithSync(spaceId);
              console.log('✅ Space archived successfully');
            } catch (error) {
              console.error('❌ Error archiving space:', error);
              Alert.alert('Error', 'Failed to archive space. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteSpace = async (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (!space) return;

    // Check if space has items
    const { itemsStore } = await import('../stores/items');
    const items = itemsStore.items.get();
    const itemsInSpace = items.filter(item => item.space_id === spaceId && !item.is_deleted);
    const itemCount = itemsInSpace.length;

    if (itemCount === 0) {
      // Space is empty, delete immediately
      Alert.alert(
        'Delete Space',
        `Are you sure you want to delete "${space.name}"?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await spacesActions.removeSpaceWithSync(spaceId, false);
                console.log('✅ Space deleted successfully');
              } catch (error) {
                console.error('❌ Error deleting space:', error);
                Alert.alert('Error', 'Failed to delete space. Please try again.');
              }
            },
          },
        ]
      );
    } else {
      // Space has items, show options
      Alert.alert(
        'Delete Space',
        `This space contains ${itemCount} item${itemCount !== 1 ? 's' : ''}. What would you like to do?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Move to Everything',
            onPress: async () => {
              try {
                await spacesActions.removeSpaceWithSync(spaceId, false);
                console.log('✅ Space deleted, items moved to Everything');
              } catch (error) {
                console.error('❌ Error deleting space:', error);
                Alert.alert('Error', 'Failed to delete space. Please try again.');
              }
            },
          },
          {
            text: 'Delete All',
            style: 'destructive',
            onPress: async () => {
              try {
                await spacesActions.removeSpaceWithSync(spaceId, true);
                console.log('✅ Space and items deleted successfully');
              } catch (error) {
                console.error('❌ Error deleting space:', error);
                Alert.alert('Error', 'Failed to delete space. Please try again.');
              }
            },
          },
        ]
      );
    }
  };

  return (
    <BaseModal visible={visible} onClose={onClose}>
      <ModalHeader
        title="Manage Spaces"
        subtitle="Drag to reorder, tap to navigate, or tap ⋮ to edit"
        onClose={onClose}
        isDarkMode={isDarkMode}
      />

      <View style={styles.spacesContainer}>
        <DraggableFlatList
          data={spaces}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.spacesList}
          ListFooterComponent={(
            <View style={styles.archiveSpaceContainer}>
              <View style={[styles.spaceItem, isDarkMode && styles.spaceItemDark, styles.archiveSpace]}>
                <TouchableOpacity
                  style={[styles.spaceItemContent, { paddingVertical: 6, paddingLeft: 8 }]}
                  onPress={() => navigateToSpace(SPECIAL_SPACES.ARCHIVE_ID)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="archive"
                    size={18}
                    color={isDarkMode ? '#AAAAAA' : '#666666'}
                    style={{ marginRight: 12, marginLeft: 27 }}
                  />
                  <Text
                    style={[styles.spaceText, isDarkMode && styles.spaceTextDark, styles.archiveText]}
                    numberOfLines={1}
                  >
                    Archive
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          onDragEnd={({ data }) => {
            const spacesWithOrder = data.map((space, index) => ({
              ...space,
              order_index: index,
            }));
            spacesActions.reorderSpacesWithSync(spacesWithOrder);
          }}
          renderItem={({ item, drag }) => (
            <ScaleDecorator>
              <View style={[styles.spaceItem, isDarkMode && styles.spaceItemDark]}>
                <TouchableOpacity
                  onPressIn={drag}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ paddingHorizontal: 4, paddingVertical: 4, marginRight: 4 }}
                >
                  <MaterialIcons
                    name="drag-handle"
                    size={20}
                    color={isDarkMode ? '#999' : '#666'}
                    style={{ marginRight: 4 }}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.spaceItemContent, { paddingVertical: 6 }]}
                  onPress={() => navigateToSpace(item.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.spaceColor,
                      { backgroundColor: item.color || '#007AFF' },
                    ]}
                  />
                  <Text
                    style={[styles.spaceText, isDarkMode && styles.spaceTextDark]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>

                <Host style={{ width: 24, height: 24 }}>
                  <ContextMenu>
                    <ContextMenu.Trigger>
                      <TouchableOpacity style={styles.menuDots}>
                        <MaterialIcons
                          name="more-vert"
                          size={20}
                          color={isDarkMode ? '#999' : '#666'}
                        />
                      </TouchableOpacity>
                    </ContextMenu.Trigger>
                    <ContextMenu.Items>
                      <Button onPress={() => handleEditSpace(item.id)}>
                        {`Edit ${item.name}`}
                      </Button>
                      <Button onPress={() => handleArchiveSpace(item.id)}>
                        Archive Space
                      </Button>
                      <Button onPress={() => handleDeleteSpace(item.id)} role="destructive">
                        Delete Space
                      </Button>
                    </ContextMenu.Items>
                  </ContextMenu>
                </Host>
              </View>
            </ScaleDecorator>
          )}
        />
      </View>
    </BaseModal>
  );
});

export default SpacesManagementModal;

const styles = StyleSheet.create({
  spacesContainer: {
    flexShrink: 1,
    marginBottom: 16,
  },
  spacesList: {
    paddingBottom: 16,
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginBottom: 5,
  },
  spaceItemDark: {
    backgroundColor: '#2C2C2E',
  },
  spaceItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuDots: {
    padding: 3,
  },
  spaceColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  spaceText: {
    fontSize: 15,
    color: '#000000',
    flex: 1,
  },
  spaceTextDark: {
    color: '#FFFFFF',
  },
  archiveSpaceContainer: {
    marginTop: 8,
  },
  archiveSpace: {
    opacity: 0.8,
  },
  archiveText: {
    fontWeight: '500',
    opacity: 0.9,
  },
});
