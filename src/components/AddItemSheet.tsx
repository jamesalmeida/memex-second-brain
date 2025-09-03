import React, { forwardRef, useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Clipboard,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  InputAccessoryView,
  Button,
  Dimensions,
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
    const [url, setUrl] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    
    // Snap points for the bottom sheet
    // Using percentages - 30% for initial, 75% when keyboard shows
    const snapPoints = useMemo(() => {
      const points = ['30%', '75%'];
      console.log('Snap points set to:', points);
      return points;
    }, []);

    // Keyboard event listeners
    useEffect(() => {
      console.log('Setting up keyboard listeners');
      
      const keyboardWillShow = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e) => {
          console.log('Keyboard will/did show, height:', e.endCoordinates.height);
          setKeyboardHeight(e.endCoordinates.height);
          setIsKeyboardVisible(true);
          // Don't snap here - let onFocus handle it
        }
      );

      const keyboardWillHide = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => {
          console.log('Keyboard will/did hide');
          setKeyboardHeight(0);
          setIsKeyboardVisible(false);
          // Don't auto-snap back - let user control sheet position
        }
      );

      return () => {
        keyboardWillShow.remove();
        keyboardWillHide.remove();
      };
    }, [ref]);

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

    const handlePaste = async () => {
      try {
        const clipboardContent = await Clipboard.getString();
        if (clipboardContent) {
          setUrl(clipboardContent);
          // Auto-detect content type from URL pattern
          detectContentType(clipboardContent);
        }
      } catch (error) {
        console.error('Failed to paste from clipboard:', error);
      }
    };

    const detectContentType = (urlString: string) => {
      const lowerUrl = urlString.toLowerCase();
      if (lowerUrl.includes('youtube.com') || lowerUrl.includes('vimeo.com')) {
        setSelectedType('video');
      } else if (lowerUrl.match(/\.(jpg|jpeg|png|gif|svg|webp)/i)) {
        setSelectedType('image');
      } else if (lowerUrl.includes('amazon.com') || lowerUrl.includes('ebay.com')) {
        setSelectedType('product');
      } else if (lowerUrl.includes('medium.com') || lowerUrl.includes('blog')) {
        setSelectedType('article');
      } else {
        setSelectedType('bookmark');
      }
    };

    const handleSave = () => {
      if (!url.trim()) {
        Alert.alert('Error', 'Please enter a URL');
        return;
      }

      // TODO: Implement actual save logic
      console.log('Saving item:', { type: selectedType, url });
      
      // Dismiss keyboard first
      Keyboard.dismiss();
      
      // Reset form
      setUrl('');
      setSelectedType('bookmark');
      
      // Close sheet after keyboard dismisses
      setTimeout(() => {
        if (ref && 'current' in ref && ref.current) {
          ref.current.close();
        }
      }, 100);
      
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
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
        keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(index) => {
          console.log('Sheet index changed to:', index);
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Save New Item
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, !url.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!url.trim()}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => {
            console.log('Scroll began - dismissing keyboard');
            Keyboard.dismiss();
          }}
          scrollEnabled={true}
        >
          {/* Primary Input Field */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
          <View style={styles.section}>
            <TextInput
              style={[styles.input, styles.primaryInput, isDarkMode && styles.inputDark]}
              placeholder="Type a note or paste something here..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                detectContentType(text);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              numberOfLines={3}
              onFocus={() => {
                console.log('Input focused - snapping to index 1');
                // Manually snap to higher position when input is focused
                setTimeout(() => {
                  if (ref && 'current' in ref && ref.current) {
                    console.log('Attempting to snap to index 1, snapPoints:', snapPoints);
                    ref.current.snapToIndex(1);
                    // Force expand if snap doesn't work
                    setTimeout(() => {
                      if (ref && 'current' in ref && ref.current) {
                        console.log('Force expanding sheet');
                        ref.current.expand();
                      }
                    }, 200);
                  } else {
                    console.log('Ref not available');
                  }
                }, 150);
              }}
              onBlur={() => console.log('Input blurred')}
              inputAccessoryViewID={Platform.OS === 'ios' ? 'doneAccessory' : undefined}
            />
          </View>
          </KeyboardAvoidingView>

          {/* Quick Actions */}
          <View style={styles.section}>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => {
                  console.log('Camera pressed - dismissing keyboard');
                  Keyboard.dismiss();
                }}
              >
                <MaterialIcons
                  name="camera-alt"
                  size={28}
                  color="#FF6B35"
                />
                <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>
                  Camera
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <MaterialIcons
                  name="photo-library"
                  size={28}
                  color="#FF6B35"
                />
                <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>
                  Gallery
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction} onPress={handlePaste}>
                <MaterialIcons
                  name="content-paste"
                  size={28}
                  color="#FF6B35"
                />
                <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>
                  Paste
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Content Type Selection - Hidden below fold */}
          <View style={[styles.section, styles.typeSection]}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Type (Auto-detected)
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
        </BottomSheetScrollView>
        
        {/* iOS Keyboard Done Button */}
        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID="doneAccessory">
            <View style={styles.inputAccessory}>
              <Button
                onPress={() => {
                  console.log('Done button pressed');
                  Keyboard.dismiss();
                }}
                title="Done"
              />
            </View>
          </InputAccessoryView>
        )}
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
  primaryInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    padding: 16,
    flex: 1,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  quickActionTextDark: {
    color: '#AAAAAA',
  },
  typeSection: {
    marginTop: 30,
  },
  inputAccessory: {
    backgroundColor: '#F2F2F7',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
  },
});

export default AddItemSheet;