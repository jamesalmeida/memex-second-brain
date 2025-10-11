import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { observer } from '@legendapp/state/react';
import { MaterialIcons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { spacesComputed, spacesActions } from '../stores/spaces';
import { Space } from '../types';

export interface ReorderSpacesSheetRef {
  snapToIndex: (index: number) => void;
  open: () => void;
}

interface ReorderSpacesSheetProps {
  onClose?: () => void;
}

const ReorderSpacesSheet = observer(forwardRef<ReorderSpacesSheetRef, ReorderSpacesSheetProps>(
  ({ onClose }, ref) => {
    console.log('🔄 [ReorderSpacesSheet] Component rendering');
    const isDarkMode = themeStore.isDarkMode.get();
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [orderedSpaces, setOrderedSpaces] = useState<Space[]>([]);

    const snapPoints = useMemo(() => {
      console.log('🔄 [ReorderSpacesSheet] snapPoints memoized:', ['95%']);
      return ['95%'];
    }, []);

    useImperativeHandle(ref, () => ({
      snapToIndex: (index: number) => {
        console.log('🔄 [ReorderSpacesSheet] snapToIndex called with index:', index);
        console.log('🔄 [ReorderSpacesSheet] bottomSheetRef.current:', bottomSheetRef.current);

        // Load current spaces when opening
        const spaces = spacesComputed.spaces();
        console.log('🔄 [ReorderSpacesSheet] Loading spaces:', spaces.length);
        setOrderedSpaces([...spaces]);

        bottomSheetRef.current?.snapToIndex(index);
        console.log('🔄 [ReorderSpacesSheet] Sheet should now be open');
      },
      open: () => {
        console.log('🔄 [ReorderSpacesSheet] open called');
        const spaces = spacesComputed.spaces();
        console.log('🔄 [ReorderSpacesSheet] Loading spaces:', spaces.length);
        setOrderedSpaces([...spaces]);
        bottomSheetRef.current?.expand();
      },
    }));


    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      ),
      []
    );

    const handleCancel = () => {
      bottomSheetRef.current?.close();
    };

    const handleSave = async () => {
      try {
        console.log('💾 Saving space order...');

        // Assign order_index to each space based on current position
        const spacesWithOrder = orderedSpaces.map((space, index) => ({
          ...space,
          order_index: index,
        }));

        // Update store and sync to Supabase
        await spacesActions.reorderSpacesWithSync(spacesWithOrder);

        console.log('✅ Space order saved successfully');
        bottomSheetRef.current?.close();
      } catch (error) {
        console.error('❌ Error saving space order:', error);
        Alert.alert('Error', 'Failed to save space order. Please try again.');
      }
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<Space>) => (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.spaceItem,
            isDarkMode && styles.spaceItemDark,
            isActive && styles.spaceItemActive,
          ]}
        >
          <MaterialIcons
            name="drag-handle"
            size={24}
            color={isDarkMode ? '#666' : '#999'}
            style={styles.dragHandle}
          />
          <View
            style={[
              styles.spaceColor,
              { backgroundColor: item.color || '#007AFF' },
            ]}
          />
          <Text
            style={[styles.spaceName, isDarkMode && styles.spaceNameDark]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      </ScaleDecorator>
    );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.bottomSheet,
          isDarkMode && styles.bottomSheetDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Text style={[styles.cancelText, isDarkMode && styles.cancelTextDark]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>
              Reorder Spaces
            </Text>
            <View style={styles.cancelButton} />
          </View>

          {/* DraggableFlatList */}
          <View style={{ flex: 1 }}>
            <DraggableFlatList
              data={orderedSpaces}
              onDragEnd={({ data }) => setOrderedSpaces(data)}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
            />
          </View>

          {/* Save Button */}
          <View style={[styles.footer, isDarkMode && styles.footerDark]}>
            <TouchableOpacity
              style={[styles.saveButton, isDarkMode && styles.saveButtonDark]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  }
));

export default ReorderSpacesSheet;

const styles = StyleSheet.create({
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#D1D1D6',
  },
  handleIndicatorDark: {
    backgroundColor: '#48484A',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelButton: {
    width: 60,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  cancelTextDark: {
    color: '#0A84FF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  spaceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  spaceItemDark: {
    backgroundColor: '#2C2C2E',
  },
  spaceItemActive: {
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    marginRight: 12,
  },
  spaceColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  spaceName: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  spaceNameDark: {
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  footerDark: {
    backgroundColor: '#1C1C1E',
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDark: {
    backgroundColor: '#0A84FF',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
