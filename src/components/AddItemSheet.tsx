import React, { forwardRef, useMemo, useCallback, useState, useEffect, useImperativeHandle, useRef } from 'react';
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
import uuid from 'react-native-uuid';
import { Image } from 'expo-image';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { spacesStore, spacesComputed, spacesActions } from '../stores/spaces';
import { itemsStore, itemsActions } from '../stores/items';
import { itemSpacesActions } from '../stores/itemSpaces';
import { itemTypeMetadataActions } from '../stores/itemTypeMetadata';
import { itemMetadataActions } from '../stores/itemMetadata';
import { authComputed } from '../stores/auth';
import { extractURLMetadata, generateTags, detectURLType, URLMetadata } from '../services/urlMetadata';
import { COLORS, UI } from '../constants';
import { Space, Item, ContentType } from '../types';
import { CONTENT_TYPES } from '../constants';

interface AddItemSheetProps {
  onItemAdded?: () => void;
  preSelectedSpaceId?: string | null;
  onOpen?: () => void;
  onClose?: () => void;
}

// Create contentTypes array from CONTENT_TYPES constant
// Only include the most common types in the UI
const contentTypes = [
  { id: 'bookmark', icon: 'bookmark', label: 'Bookmark' },
  { id: 'note', icon: 'note', label: 'Note' },
  { id: 'youtube', icon: 'ondemand-video', label: 'YouTube' },
  { id: 'youtube_short', icon: 'movie', label: 'YT Short' },
  { id: 'x', icon: 'tag', label: 'X/Twitter' },
  { id: 'instagram', icon: 'photo-camera', label: 'Instagram' },
  { id: 'reddit', icon: 'forum', label: 'Reddit' },
  { id: 'podcast', icon: 'podcasts', label: 'Podcast' },
  { id: 'article', icon: 'article', label: 'Article' },
  { id: 'image', icon: 'image', label: 'Image' },
  { id: 'video', icon: 'videocam', label: 'Video' },
  { id: 'product', icon: 'shopping-bag', label: 'Product' },
];

const AddItemSheet = observer(
  forwardRef<any, AddItemSheetProps>(({ onItemAdded, preSelectedSpaceId, onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const spaces = spacesComputed.spaces();
    const bottomSheetRef = useRef<BottomSheet>(null);
    
    const [selectedType, setSelectedType] = useState('bookmark');
    const [url, setUrl] = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(preSelectedSpaceId || null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);
    const [metadata, setMetadata] = useState<URLMetadata | null>(null);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [isGeneratingTags, setIsGeneratingTags] = useState(false);
    
    // Snap points for the bottom sheet - 85% height
    const snapPoints = useMemo(() => {
      const points = ['85%'];
      return points;
    }, []);

    // Effect to update selected space when prop changes
    useEffect(() => {
      if (preSelectedSpaceId) {
        setSelectedSpaceId(preSelectedSpaceId);
      }
    }, [preSelectedSpaceId]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      snapToIndex: (index: number) => bottomSheetRef.current?.snapToIndex(index),
      openWithSpace: (spaceId: string) => {
        setSelectedSpaceId(spaceId);
        bottomSheetRef.current?.snapToIndex(0);
      },
      expand: () => bottomSheetRef.current?.expand(),
      close: () => bottomSheetRef.current?.close(),
    }), []);

    // Keyboard event listeners for height tracking
    useEffect(() => {
      console.log('Setting up keyboard listeners');
      
      const keyboardWillShow = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (e) => {
          console.log('Keyboard will/did show, height:', e.endCoordinates.height);
          setKeyboardHeight(e.endCoordinates.height);
          setIsKeyboardVisible(true);
        }
      );

      const keyboardWillHide = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => {
          console.log('Keyboard will/did hide');
          setKeyboardHeight(0);
          setIsKeyboardVisible(false);
        }
      );

      return () => {
        keyboardWillShow.remove();
        keyboardWillHide.remove();
      };
    }, []);

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
      const detectedType = detectURLType(urlString);
      setSelectedType(detectedType);
    };

    // Extract metadata when URL is detected
    useEffect(() => {
      const timeoutId = setTimeout(() => {
        if (url.trim() && url.startsWith('http')) {
          setIsLoadingMetadata(true);
          extractURLMetadata(url.trim())
            .then(data => {
              setMetadata(data);
              setIsLoadingMetadata(false);
              // Update content type based on metadata
              if (data.contentType) {
                setSelectedType(data.contentType);
              }
            })
            .catch(err => {
              console.error('Metadata extraction failed:', err);
              setIsLoadingMetadata(false);
            });
        } else {
          setMetadata(null);
        }
      }, 800); // Debounce for 800ms

      return () => clearTimeout(timeoutId);
    }, [url]);

    const handleAddTag = () => {
      const trimmedTag = tagInput.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        setTags([...tags, trimmedTag]);
        setTagInput('');
        setShowTagInput(false);
      }
    };

    const handleRemoveTag = (tagToRemove: string) => {
      setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleGenerateTags = async () => {
      if (!url.trim()) return;
      
      setIsGeneratingTags(true);
      try {
        const generatedTags = await generateTags(url, metadata || undefined);
        // Add generated tags to existing tags (avoiding duplicates)
        const newTags = [...tags];
        generatedTags.forEach(tag => {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
          }
        });
        setTags(newTags);
      } catch (error) {
        console.error('Tag generation failed:', error);
        Alert.alert('Error', 'Failed to generate tags');
      } finally {
        setIsGeneratingTags(false);
      }
    };

    const handleSave = async () => {
      if (!url.trim()) {
        Alert.alert('Error', 'Please enter some content');
        return;
      }

      const userId = authComputed.userId();
      if (!userId) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Create the new item with only fields that exist in the items table
      const newItem: Item = {
        id: uuid.v4() as string,
        user_id: userId,
        title: metadata?.title && metadata.title !== 'No title' ? metadata.title : url.slice(0, 50),
        desc: metadata?.description || undefined,
        content: selectedType === 'note' ? url : undefined,
        url: selectedType !== 'note' ? url : undefined,
        thumbnail_url: metadata?.image || undefined,
        content_type: metadata?.contentType || selectedType as ContentType,
        tags: tags.length > 0 ? tags : undefined,
        is_archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Add to the items store with Supabase sync
      await itemsActions.addItemWithSync(newItem);
      
      // Create item_type_metadata if we have video_url or image_urls
      if (metadata?.videoUrl || metadata?.images) {
        await itemTypeMetadataActions.upsertTypeMetadata({
          item_id: newItem.id,
          data: {
            video_url: metadata?.videoUrl,
            image_urls: metadata?.images,
          },
        });
      }
      
      // Create item_metadata if we have author or domain info
      if (metadata?.author || metadata?.domain) {
        await itemMetadataActions.upsertMetadata({
          item_id: newItem.id,
          author: metadata?.author,
          domain: metadata?.domain,
        });
      }
      
      // Create item_spaces relationship if item was added to a space
      if (selectedSpaceId) {
        await itemSpacesActions.addItemToSpace(newItem.id, selectedSpaceId);
        
        // Update space item count
        const spaces = spacesStore.spaces.get();
        const space = spaces.find(s => s.id === selectedSpaceId);
        if (space) {
          spacesActions.updateSpace(selectedSpaceId, { 
            item_count: (space.item_count || 0) + 1 
          });
        }
      }
      
      console.log('Item saved:', newItem);
      
      // Dismiss keyboard first
      Keyboard.dismiss();
      
      // Reset form
      setUrl('');
      setSelectedType('bookmark');
      setSelectedSpaceId(null);
      setTags([]);
      setTagInput('');
      setShowTagInput(false);
      setMetadata(null);
      
      // Close sheet after keyboard dismisses
      setTimeout(() => {
        if (ref && 'current' in ref && ref.current) {
          ref.current.close();
        }
      }, 100);
      
      if (onItemAdded) {
        onItemAdded();
      }
    };

    return (
      <BottomSheet
        ref={bottomSheetRef}
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
          if (index === -1) {
            onClose?.();
          } else if (index >= 0) {
            onOpen?.();
          }
        }}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Save New Item
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, (!url.trim() || isLoadingMetadata) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!url.trim() || isLoadingMetadata}
          >
            <Text style={styles.saveButtonText}>
              {isLoadingMetadata ? 'Processing...' : 'Save'}
            </Text>
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
          {/* Primary Input Field and Quick Actions */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
          <View style={styles.section}>
            <View style={styles.inputContainer}>
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
                  console.log('Input focused');
                  // Sheet is already at 85%, no need to snap
                }}
                onBlur={() => console.log('Input blurred')}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'doneAccessory' : undefined}
              />
              
              {/* Clear Button - Always present when there's text */}
              {url.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.clearButton, isDarkMode && styles.clearButtonDark]}
                  onPress={() => {
                    setUrl('');
                    setSelectedType('bookmark');
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="close"
                    size={18}
                    color={isDarkMode ? '#999' : '#666'}
                  />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Quick Actions - Right below textarea */}
            <View style={styles.quickActionsCompact}>
              <TouchableOpacity 
                style={[styles.quickActionCompact, isDarkMode && styles.quickActionCompactDark]}
                onPress={() => {
                  console.log('Camera pressed - dismissing keyboard');
                  Keyboard.dismiss();
                }}
              >
                <MaterialIcons name="camera-alt" size={20} color="#FF6B35" />
                <Text style={[styles.quickActionTextCompact, isDarkMode && styles.quickActionTextDarkCompact]}>
                  Camera
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.quickActionCompact, isDarkMode && styles.quickActionCompactDark]}>
                <MaterialIcons name="photo-library" size={20} color="#FF6B35" />
                <Text style={[styles.quickActionTextCompact, isDarkMode && styles.quickActionTextDarkCompact]}>
                  Gallery
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.quickActionCompact, isDarkMode && styles.quickActionCompactDark]} onPress={handlePaste}>
                <MaterialIcons name="content-paste" size={20} color="#FF6B35" />
                <Text style={[styles.quickActionTextCompact, isDarkMode && styles.quickActionTextDarkCompact]}>
                  Paste
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>

          {/* Metadata Preview */}
          {isLoadingMetadata && (
            <View style={[styles.section, styles.metadataSection]}>
              <View style={[styles.metadataCard, isDarkMode && styles.metadataCardDark]}>
                <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
                  Loading metadata...
                </Text>
              </View>
            </View>
          )}
          
          {metadata && !isLoadingMetadata && (
            <View style={[styles.section, styles.metadataSection]}>
              <View style={[styles.metadataCard, isDarkMode && styles.metadataCardDark]}>
                {metadata.image && (
                  <Image 
                    source={{ uri: metadata.image }}
                    style={styles.metadataImage}
                    contentFit="cover"
                    transition={200}
                  />
                )}
                <View style={styles.metadataContent}>
                  <Text style={[styles.metadataTitle, isDarkMode && styles.metadataTitleDark]} numberOfLines={2}>
                    {metadata.title || 'No title'}
                  </Text>
                  {metadata.description && (
                    <Text style={[styles.metadataDescription, isDarkMode && styles.metadataDescriptionDark]} numberOfLines={2}>
                      {metadata.description}
                    </Text>
                  )}
                  <View style={styles.metadataFooter}>
                    {metadata.siteName && (
                      <Text style={[styles.metadataSite, isDarkMode && styles.metadataSiteDark]}>
                        {metadata.siteName}
                      </Text>
                    )}
                    {metadata.duration && (
                      <Text style={[styles.metadataDuration, isDarkMode && styles.metadataDurationDark]}>
                        {metadata.duration}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Space Selector */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
              Space
            </Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.spaceScroll}
            >
              <TouchableOpacity
                style={[
                  styles.spaceButton,
                  isDarkMode && styles.spaceButtonDark,
                  selectedSpaceId === null && styles.spaceButtonActive,
                ]}
                onPress={() => setSelectedSpaceId(null)}
              >
                <Text style={[
                  styles.spaceLabel,
                  isDarkMode && styles.spaceLabelDark,
                  selectedSpaceId === null && styles.spaceLabelActive,
                ]}>
                  No Space
                </Text>
              </TouchableOpacity>
              {spaces.map((space) => (
                <TouchableOpacity
                  key={space.id}
                  style={[
                    styles.spaceButton,
                    isDarkMode && styles.spaceButtonDark,
                    selectedSpaceId === space.id && styles.spaceButtonActive,
                  ]}
                  onPress={() => setSelectedSpaceId(space.id)}
                >
                  {selectedSpaceId !== space.id && (
                    <View style={[styles.spaceIndicator, { backgroundColor: space.color }]} />
                  )}
                  <Text style={[
                    styles.spaceLabel,
                    isDarkMode && styles.spaceLabelDark,
                    selectedSpaceId === space.id && styles.spaceLabelActive,
                  ]}>
                    {space.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <View style={styles.tagsHeader}>
              <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
                Tags
              </Text>
              <TouchableOpacity
                style={[styles.aiButton, isDarkMode && styles.aiButtonDark, isGeneratingTags && styles.aiButtonDisabled]}
                onPress={handleGenerateTags}
                disabled={isGeneratingTags || !url.trim()}
              >
                <Text style={[styles.aiButtonText, isDarkMode && styles.aiButtonTextDark]}>
                  {isGeneratingTags ? 'Generating...' : '✨ AI Generate'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Tags Display - All in one container */}
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={[styles.tagChip, isDarkMode && styles.tagChipDark]}>
                  <Text style={[styles.tagText, isDarkMode && styles.tagTextDark]}>
                    {tag}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveTag(tag)}
                    style={styles.tagRemoveButton}
                  >
                    <Text style={[styles.tagRemoveText, isDarkMode && styles.tagRemoveTextDark]}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Add Tag Button/Input */}
              {showTagInput ? (
                <View style={[styles.tagInputContainer, isDarkMode && styles.tagInputContainerDark]}>
                  <TextInput
                    style={[styles.tagInput, isDarkMode && styles.tagInputDark]}
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={handleAddTag}
                    placeholder="Add tag..."
                    placeholderTextColor={isDarkMode ? '#666' : '#999'}
                    autoFocus
                    onBlur={() => {
                      if (!tagInput.trim()) {
                        setShowTagInput(false);
                      }
                    }}
                    returnKeyType="done"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addTagButton, isDarkMode && styles.addTagButtonDark]}
                  onPress={() => setShowTagInput(true)}
                >
                  <Text style={[styles.addTagButtonText, isDarkMode && styles.addTagButtonTextDark]}>
                    + Add Tag
                  </Text>
                </TouchableOpacity>
              )}
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
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    paddingRight: 40, // Make room for clear button
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
  clearButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
  // Compact quick actions styles
  quickActionsCompact: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  quickActionCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  quickActionCompactDark: {
    backgroundColor: '#2C2C2E',
  },
  quickActionTextCompact: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  quickActionTextDarkCompact: {
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
  // Metadata styles
  metadataSection: {
    paddingTop: 10,
  },
  metadataCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
  },
  metadataCardDark: {
    backgroundColor: '#2C2C2E',
  },
  metadataImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  metadataContent: {
    flex: 1,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  metadataTitleDark: {
    color: '#FFFFFF',
  },
  metadataDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  metadataDescriptionDark: {
    color: '#AAAAAA',
  },
  metadataSite: {
    fontSize: 12,
    color: '#999999',
  },
  metadataSiteDark: {
    color: '#777777',
  },
  metadataFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataDuration: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  metadataDurationDark: {
    color: '#AAAAAA',
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  loadingTextDark: {
    color: '#AAAAAA',
  },
  // Space selector styles
  spaceScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  spaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
  },
  spaceButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  spaceButtonActive: {
    backgroundColor: '#FF6B35',
  },
  spaceIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  spaceLabel: {
    fontSize: 14,
    color: '#666666',
  },
  spaceLabelDark: {
    color: '#AAAAAA',
  },
  spaceLabelActive: {
    color: '#FFFFFF',
  },
  // Tags styles
  tagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  aiButtonDark: {
    backgroundColor: '#0A84FF',
  },
  aiButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  aiButtonTextDark: {
    color: '#FFF',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    minWidth: 100,
  },
  tagInputContainerDark: {
    backgroundColor: '#2C2C2E',
  },
  tagInput: {
    fontSize: 14,
    color: '#333',
    padding: 0,
    minWidth: 80,
  },
  tagInputDark: {
    color: '#FFF',
  },
  addTagButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  addTagButtonDark: {
    borderColor: '#3C3C3E',
  },
  addTagButtonText: {
    fontSize: 14,
    color: '#666',
  },
  addTagButtonTextDark: {
    color: '#999',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipDark: {
    backgroundColor: '#2C2C2E',
  },
  tagText: {
    fontSize: 14,
    color: '#333',
  },
  tagTextDark: {
    color: '#FFF',
  },
  tagRemoveButton: {
    marginLeft: 6,
  },
  tagRemoveText: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  tagRemoveTextDark: {
    color: '#666',
  },
});

export default AddItemSheet;