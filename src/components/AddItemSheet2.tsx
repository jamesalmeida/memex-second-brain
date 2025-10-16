import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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

interface AddItemSheet2Props {
  onOpen?: () => void;
  onClose?: () => void;
}

const AddItemSheet2 = observer(forwardRef<any, AddItemSheet2Props>(({ onOpen, onClose }, ref) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [input, setInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedUI, setSavedUI] = useState<{ visible: boolean; title?: string } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapPoints = useMemo(() => ['30%', '70%'], []);

  useImperativeHandle(ref, () => ({
    snapToIndex: (index: number) => bottomSheetRef.current?.snapToIndex(index),
    expand: () => bottomSheetRef.current?.expand(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
  );

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setInput(text);
  };

  const handleSave = async () => {
    const url = input.trim();
    if (!url) {
      Alert.alert('Enter a URL or note');
      return;
    }

    const userId = authComputed.userId();
    if (!userId) {
      Alert.alert('Not signed in');
      return;
    }

    setIsSaving(true);
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
        .catch(() => {})
        .finally(() => {
          processingItemsActions.remove(id);
        });
    } finally {
      setIsSaving(false);
    }
  };

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
        if (index === -1) {
          if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
          onClose?.();
          setSavedUI(null);
          setInput('');
        } else if (index >= 0) {
          onOpen?.();
        }
      }}
    >
      <View style={styles.header}>
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>Save</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.quickAction, isDarkMode && styles.quickActionDark]} onPress={handlePaste}>
            <MaterialIcons name="content-paste" size={20} color="#FF6B35" />
            <Text style={[styles.quickActionText, isDarkMode && styles.quickActionTextDark]}>Paste</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, (!input.trim() || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!input.trim() || isSaving}
          >
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {savedUI?.visible ? (
          <View style={styles.successPillContainer}>
            <View style={styles.successPill}>
              <MaterialIcons name="check" size={16} color="#fff" />
              <Text style={styles.successText}>Saved to Memex</Text>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.inputContainer}>
              <BottomSheetTextInput
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="Paste a link or type a note"
                placeholderTextColor={isDarkMode ? '#666' : '#999'}
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
                  <MaterialIcons name="close" size={18} color={isDarkMode ? '#999' : '#666'} />
                </TouchableOpacity>
              )}
            </View>
            {/* Quick actions row removed; Paste moved to header */}
          </View>
        )}
      </BottomSheetScrollView>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="doneAccessory2">
          <View style={styles.inputAccessory}><Button title="Done" onPress={Keyboard.dismiss} /></View>
        </InputAccessoryView>
      )}
    </BottomSheet>
  );
}));

export default AddItemSheet2;

const styles = StyleSheet.create({
  sheetBackground: { backgroundColor: '#FFFFFF' },
  sheetBackgroundDark: { backgroundColor: '#1C1C1E' },
  handleIndicator: { backgroundColor: '#CCCCCC', width: 40 },
  handleIndicatorDark: { backgroundColor: '#666666' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5E7' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000000' },
  titleDark: { color: '#FFFFFF' },
  saveButton: { backgroundColor: '#FF6B35', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  scrollContent: { paddingBottom: 24 },
  section: { paddingTop: 16, paddingHorizontal: 20 },
  inputContainer: { position: 'relative' },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 12, paddingRight: 40, fontSize: 16, color: '#000000', minHeight: 80, textAlignVertical: 'top' },
  inputDark: { backgroundColor: '#2C2C2E', color: '#FFFFFF' },
  clearButton: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0, 0, 0, 0.1)', alignItems: 'center', justifyContent: 'center' },
  clearButtonDark: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  quickActionsRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  quickAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  quickActionDark: { backgroundColor: '#2C2C2E' },
  quickActionText: { fontSize: 12, color: '#666666', fontWeight: '500' },
  quickActionTextDark: { color: '#AAAAAA' },
  inputAccessory: { backgroundColor: '#F2F2F7', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 10, paddingVertical: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E7' },
  successPillContainer: { paddingTop: 20, paddingHorizontal: 20 },
  successPill: { alignSelf: 'center', backgroundColor: '#22C55E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  successText: { color: '#fff', fontWeight: '600', marginLeft: 6, fontSize: 16 },
});


