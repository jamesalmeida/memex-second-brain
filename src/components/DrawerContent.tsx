import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Feather } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { themeStore } from '../stores/theme';
import { spacesComputed, spacesActions } from '../stores/spaces';
import { useDrawer } from '../contexts/DrawerContext';
import { COLORS, SPECIAL_SPACES } from '../constants';

const DrawerContentInner = observer(() => {
  console.log('🎨 [DrawerContent] Body rendered');

  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const spaces = spacesComputed.activeSpaces();
  const {
    onSettingsPress,
    onTagManagerPress,
    onCreateSpacePress,
    onEditSpacePress,
    onNavigateToSpace,
    onNavigateToEverything,
  } = useDrawer();

  const navigateToSpace = (spaceId: string) => {
    console.log('🚪 [DrawerContent] Navigate to space:', spaceId);
    onNavigateToSpace(spaceId);
  };

  const handleEditSpace = (spaceId: string) => {
    console.log('📝 Edit space:', spaceId);
    onEditSpacePress(spaceId);
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
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <DraggableFlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 70 },
        ]}
        ListHeaderComponent={(
          <View>
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={onSettingsPress}
              >
                <MaterialIcons
                  name="settings"
                  size={24}
                  color={isDarkMode ? '#FFFFFF' : '#000000'}
                />
                <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
                  Settings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, { marginTop: 12 }]}
                onPress={onTagManagerPress}
              >
                <MaterialIcons
                  name="label"
                  size={24}
                  color={isDarkMode ? '#FFFFFF' : '#000000'}
                />
                <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
                  Manage Tags
                </Text>
              </TouchableOpacity>
            </View>

            {/* <View style={[styles.divider, isDarkMode && styles.dividerDark]} /> */}

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  console.log('🚪 [DrawerContent] Everything pressed');
                  onNavigateToEverything();
                }}
              >
                <MaterialIcons
                  name="grid-view"
                  size={24}
                  color={isDarkMode ? '#FFFFFF' : '#000000'}
                />
                <Text style={[styles.menuText, isDarkMode && styles.menuTextDark]}>
                  Everything
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Feather
                name="box"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
              />
              <Text style={[styles.menuText, isDarkMode && styles.sectionTitleDark]}>
                Spaces
              </Text>
              <TouchableOpacity
                style={[styles.addButton, isDarkMode && styles.addButtonDark]}
                onPress={onCreateSpacePress}
              >
                <MaterialIcons
                  name="add"
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={[styles.addButtonText, isDarkMode && styles.addButtonTextDark]}>
                  New Space
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  );
});

export const DrawerContentBody = DrawerContentInner;

interface DrawerContentProps {
  onClose: () => void;
}

const DrawerContent = ({ onClose: _onClose }: DrawerContentProps) => {
  return <DrawerContentInner />;
};

export default DrawerContent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  appTitleDark: {
    color: '#FFFFFF',
  },
  appSubtitle: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  appSubtitleDark: {
    color: '#999999',
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 12,
    // marginTop: 5,
    marginRight: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 'auto',
    backgroundColor: COLORS.primary,
    gap: 4,
  },
  addButtonDark: {
    backgroundColor: COLORS.primary,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextDark: {
    color: '#FFFFFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 10,
    textTransform: 'uppercase',
  },
  menuTextDark: {
    color: '#FFFFFF',
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginLeft: 14,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    // marginVertical: 20,
    marginBottom: 20,
  },
  dividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  archiveSpaceContainer: {
    // marginTop: 12,
  },
  archiveSpace: {
    opacity: 0.8,
  },
  archiveText: {
    fontWeight: '500',
    opacity: 0.9,
  },
});
