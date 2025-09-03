import React, { forwardRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { COLORS, UI } from '../constants';

interface AddItemSheetProps {
  onItemAdded?: () => void;
}

const contentTypes = [
  { id: 'bookmark', icon: 'bookmark', label: 'Bookmark' },
  { id: 'note', icon: 'note', label: 'Note' },
  { id: 'image', icon: 'image', label: 'Image' },
  { id: 'video', icon: 'videocam', label: 'Video' },
  { id: 'article', icon: 'article', label: 'Article' },
  { id: 'product', icon: 'shopping-bag', label: 'Product' },
];

const AddItemSheet = observer(
  forwardRef<BottomSheet, AddItemSheetProps>(({ onItemAdded }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const [selectedType, setSelectedType] = useState('bookmark');
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [notes, setNotes] = useState('');
    
    // Snap points for the bottom sheet
    const snapPoints = useMemo(() => ['40%', '75%'], []);

    // Render backdrop
    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const handleSave = () => {
      if (!title.trim()) {
        Alert.alert('Error', 'Please enter a title');
        return;
      }

      // TODO: Implement actual save logic
      console.log('Saving item:', { type: selectedType, title, url, notes });
      
      // Reset form
      setTitle('');
      setUrl('');
      setNotes('');
      setSelectedType('bookmark');
      
      // Close sheet
      if (ref && 'current' in ref && ref.current) {
        ref.current.close();
      }
      
      if (onItemAdded) {
        onItemAdded();
      }
      
      Alert.alert('Success', 'Item saved successfully!');
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Save New Item
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!title.trim()}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Content Type Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Type
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.typeScroll}
            >
              {contentTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeButton,
                    isDarkMode && styles.typeButtonDark,
                    selectedType === type.id && styles.typeButtonActive,
                  ]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <MaterialIcons
                    name={type.icon as any}
                    size={24}
                    color={
                      selectedType === type.id
                        ? '#FFFFFF'
                        : isDarkMode
                        ? '#AAAAAA'
                        : '#666666'
                    }
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      isDarkMode && styles.typeLabelDark,
                      selectedType === type.id && styles.typeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Title Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Title
            </Text>
            <TextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              placeholder="Enter title..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* URL Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              URL (Optional)
            </Text>
            <TextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              placeholder="https://..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={url}
              onChangeText={setUrl}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Notes Input */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Notes (Optional)
            </Text>
            <TextInput
              style={[styles.input, styles.notesInput, isDarkMode && styles.inputDark]}
              placeholder="Add notes..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction}>
                <MaterialIcons
                  name="camera-alt"
                  size={24}
                  color="#FF6B35"
                />
                <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>
                  Camera
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <MaterialIcons
                  name="photo-library"
                  size={24}
                  color="#FF6B35"
                />
                <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>
                  Gallery
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <MaterialIcons
                  name="content-paste"
                  size={24}
                  color="#FF6B35"
                />
                <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>
                  Paste
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  })
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#CCCCCC',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#666666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  sectionTitleDark: {
    color: '#999999',
  },
  typeScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  typeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginRight: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    minWidth: 80,
  },
  typeButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  typeButtonActive: {
    backgroundColor: '#FF6B35',
  },
  typeLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  typeLabelDark: {
    color: '#AAAAAA',
  },
  typeLabelActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  notesInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    padding: 12,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  quickActionTextDark: {
    color: '#AAAAAA',
  },
});

export default AddItemSheet;