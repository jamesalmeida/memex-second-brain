import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Keyboard, Platform, InputAccessoryView, Button, Alert } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import uuid from 'react-native-uuid';
import * as Clipboard from 'expo-clipboard';
import { themeStore } from '../stores/theme';
import { itemsActions } from '../stores/items';
import { authComputed } from '../stores/auth';
import { Item } from '../types';
import { processingItemsActions } from '../stores/processingItems';
import { runPipeline } from '../services/pipeline/runPipeline';
import { spacesComputed } from '../stores/spaces';
import { adminSettingsComputed } from '../stores/adminSettings';
import { buildItemContext } from '../services/contextBuilder';
import { openai } from '../services/openai';
import { itemsStore } from '../stores/items';
import UniversalButton from './UniversalButton';

interface AddItemSheetProps {
  preSelectedSpaceId?: string | null;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface AddItemSheetHandle {
  snapToIndex: (index: number) => void;
  expand: () => void;
  close: () => void;
  open: () => void;
  openWithSpace: (spaceId: string) => void;
}

const AddItemSheet = observer(forwardRef<AddItemSheetHandle, AddItemSheetProps>(({ preSelectedSpaceId = null, onOpen, onClose }, ref) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [input, setInput] = useState('');
  const [savedUI, setSavedUI] = useState<{ visible: boolean; title?: string } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(preSelectedSpaceId);
  const selectedSpaceName = selectedSpaceId ? spacesComputed.getSpaceById(selectedSpaceId)?.name ?? 'selected space' : null;
  const sheetIndexRef = useRef(-1);

  const snapToCollapsed = useCallback(() => {
    if (sheetIndexRef.current > 0) {
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, []);

  const snapPoints = useMemo(() => ['30%', '70%'], []); // Adjust heights of the Add Item Sheet

  useEffect(() => {
    setSelectedSpaceId(preSelectedSpaceId);
  }, [preSelectedSpaceId]);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subscription = Keyboard.addListener(event, snapToCollapsed);
    return () => subscription.remove();
  }, [snapToCollapsed]);

  const openSheet = useCallback((spaceId?: string | null) => {
    setSelectedSpaceId(spaceId ?? null);
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => bottomSheetRef.current?.snapToIndex(index),
    expand: () => bottomSheetRef.current?.expand(),
    close: () => {
      bottomSheetRef.current?.close();
      setSelectedSpaceId(null);
    },
    open: () => openSheet(null),
    openWithSpace: (spaceId: string) => openSheet(spaceId),
  }), [openSheet]);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  );

  const performSave = useCallback(async (value: string) => {
    const url = value.trim();
    if (!url) {
      throw new Error('Enter a URL or note');
    }

    const userId = authComputed.userId();
    if (!userId) {
      throw new Error('Not signed in');
    }

    try {
      const id = uuid.v4() as string;
      const now = new Date().toISOString();
      let provisionalTitle = url;
      try { provisionalTitle = new URL(url).hostname.replace('www.', ''); } catch {}

      const newItem: Item = {
        id,
        user_id: userId,
        title: provisionalTitle,
        url,
        content_type: 'bookmark',
        is_archived: false,
        space_id: selectedSpaceId || null,
        created_at: now,
        updated_at: now,
      };

      await itemsActions.addItemWithSync(newItem);
      processingItemsActions.add(id);

      // Optimistic success UI in the sheet
      setSavedUI({ visible: true, title: provisionalTitle });
      Keyboard.dismiss();

      // Auto-close the sheet after 0.8 second on success
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        bottomSheetRef.current?.close();
      }, 800);

      // Run the numbered pipeline (detect type, parse, enrich)
      runPipeline({ itemId: id, url })
        .then(async () => {
          // Auto-generate TLDR if enabled (global admin setting)
          if (adminSettingsComputed.autoGenerateTldr()) {
            try {
              // Get the latest item data after pipeline completion
              const updatedItem = itemsStore.items.get().find(i => i.id === id);
              if (updatedItem && !updatedItem.tldr) {
                console.log('🤖 Auto-generating TLDR for item:', id);

                // Build full context including transcript, images, metadata, etc.
                const contextResult = buildItemContext(updatedItem);

                // Generate summary using full context
                const generatedTldr = await openai.summarizeContent(
                  contextResult.contextString,
                  contextResult.metadata.contentType
                );

                if (generatedTldr && generatedTldr !== 'Summary not available') {
                  // Save to database
                  await itemsActions.updateItemWithSync(id, { tldr: generatedTldr });
                  console.log('✅ Auto-generated TLDR saved successfully');
                }
              }
            } catch (error) {
              console.error('❌ Error auto-generating TLDR:', error);
              // Fail silently - don't block item creation
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          processingItemsActions.remove(id);
        });
    } catch (error) {
      console.error('Error saving item:', error);
      throw error;
    }
  }, [selectedSpaceId]);

  const handleSave = useCallback(async () => {
    await performSave(input);
  }, [performSave, input]);

  const handlePasteAndSave = useCallback(async () => {
    const clipboardText = (await Clipboard.getStringAsync()).trim();
    if (!clipboardText) {
      throw new Error('Clipboard is empty. Copy a link first.');
    }
    setInput(clipboardText);
    await performSave(clipboardText);
  }, [performSave]);

  const hasInput = input.trim().length > 0;

  // Cleanup any pending close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBackground, isDarkMode && styles.sheetBackgroundDark]}
      handleIndicatorStyle={[styles.handleIndicator, isDarkMode && styles.handleIndicatorDark]}
      keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
      keyboardBlurBehavior="restore"
      onChange={(index) => {
        sheetIndexRef.current = index;
        if (index === -1) {
          Keyboard.dismiss();
          if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          onClose?.();
          setSavedUI(null);
          setInput('');
          setSelectedSpaceId(null);
        } else if (index >= 0) {
          onOpen?.();
        }
      }}
    >
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <View style={styles.headerButtonRow}>
          <View style={[styles.saveButtonWrapper, isDarkMode && styles.saveButtonWrapperDark]}>
            <UniversalButton
              label={hasInput ? 'Save' : 'Paste & Save'}
              icon={hasInput ? 'save' : 'content-paste'}
              onPress={hasInput ? handleSave : handlePasteAndSave}
              variant="primary"
              size="large"
              fullWidth
              showToastOnSuccess
              successMessage="Saved to Memex!"
              errorMessage="Failed to save item"
              style={{ borderRadius: 26 }}
            />
          </View>
        </View>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {selectedSpaceId && (
          <View style={[styles.spaceContext, isDarkMode && styles.spaceContextDark]}>
            <MaterialIcons name="folder" size={16} color={isDarkMode ? '#FFD699' : '#FF6B35'} />
            <Text style={[styles.spaceContextText, isDarkMode && styles.spaceContextTextDark]}>
              Saving to {selectedSpaceName}
            </Text>
          </View>
        )}
        {savedUI?.visible ? (
          <View style={styles.successPillContainer}>
            <View style={styles.successPill}>
              <MaterialIcons name="check" size={16} color="#fff" />
              <Text style={styles.successText}>Saved to Memex</Text>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={[styles.inputContainer, isDarkMode && styles.inputContainerDark]}>
              <BottomSheetTextInput
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="Paste a link or type here"
                placeholderTextColor={isDarkMode ? '#8E8E93' : '#A0A4B0'}
                value={input}
                onChangeText={setInput}
                onFocus={() => bottomSheetRef.current?.expand()}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                numberOfLines={3}
                inputAccessoryViewID={Platform.OS === 'ios' ? 'doneAccessory2' : undefined}
              />
              {input.trim().length > 0 && (
                <TouchableOpacity style={[styles.clearButton, isDarkMode && styles.clearButtonDark]} onPress={() => setInput('')}>
                  <MaterialIcons name="close" size={18} color={isDarkMode ? '#B0B0B5' : '#767A85'} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </BottomSheetScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="doneAccessory2">
          <View style={styles.inputAccessory}>
            <Button
              title="Done"
              onPress={() => {
                Keyboard.dismiss();
                snapToCollapsed();
              }}
            />
          </View>
        </InputAccessoryView>
      )}
    </BottomSheet>
  );
}));

export default AddItemSheet;

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: '#FFFFFF' },
  sheetBackgroundDark: { backgroundColor: '#1C1C1E' },
  handleIndicator: { backgroundColor: '#CCCCCC', width: 40 },
  handleIndicatorDark: { backgroundColor: '#666666' },
  header: { paddingHorizontal: 20, paddingVertical: 0 },
  headerButtonRow: { marginTop: 0, alignItems: 'stretch', width: '100%' },
  saveButtonWrapper: {
    backgroundColor: '#FF6B35',
    borderRadius: 26,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  saveButtonWrapperDark: {
    shadowColor: '#000000',
    backgroundColor: '#FF7C4B',
    shadowOpacity: 0.45,
  },
  saveButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDark: {
    backgroundColor: 'transparent',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonLabel: { minHeight: 24, alignItems: 'center', justifyContent: 'center', width: '100%' },
  saveButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  saveButtonContentOverlay: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveButtonIcon: { marginRight: 6 },
  scrollContent: { paddingBottom: 24 },
  spaceContext: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 12, marginHorizontal: 20, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255, 107, 53, 0.08)' },
  spaceContextDark: { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  spaceContextText: { fontSize: 13, color: '#4A4A4A', fontWeight: '600' },
  spaceContextTextDark: { color: '#F2F2F7' },
  section: { paddingTop: 16, paddingHorizontal: 20 },
  inputContainer: {
    position: 'relative',
    borderRadius: 18,
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#E8EAF2',
  },
  inputContainerDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  input: {
    backgroundColor: 'transparent',
    padding: 16,
    paddingRight: 48,
    fontSize: 16,
    color: '#000000',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inputDark: { color: '#FFFFFF' },
  clearButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonDark: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  inputAccessory: { backgroundColor: '#F2F2F7', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 10, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E7' },
  successPillContainer: { paddingTop: 20, paddingHorizontal: 20 },
  successPill: { alignSelf: 'center', backgroundColor: '#22C55E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  successText: { color: '#fff', fontWeight: '600', marginLeft: 6, fontSize: 16 },
});
