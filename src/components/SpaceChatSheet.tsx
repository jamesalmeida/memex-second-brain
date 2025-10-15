import React, { forwardRef, useImperativeHandle, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../stores/theme';

export interface SpaceChatSheetRef {
  openWithSpace: (spaceName: string) => void;
  close: () => void;
}

interface SpaceChatSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
}

const SpaceChatSheet = observer(
  forwardRef<SpaceChatSheetRef, SpaceChatSheetProps>(({ onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const insets = useSafeAreaInsets();
    const bottomSheetRef = React.useRef<BottomSheet>(null);
    const [spaceName, setSpaceName] = useState<string>('');

    useImperativeHandle(ref, () => ({
      openWithSpace: (name: string) => {
        setSpaceName(name);
        bottomSheetRef.current?.snapToIndex(1);
      },
      close: () => bottomSheetRef.current?.close(),
    }));

    const snapPoints = useMemo(() => ['100%'], []);

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

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        topInset={50}
        backgroundStyle={[styles.sheetBackground, isDarkMode && styles.sheetBackgroundDark]}
        handleIndicatorStyle={[styles.handleIndicator, isDarkMode && styles.handleIndicatorDark]}
        onChange={(index) => {
          if (index === -1) {
            onClose?.();
          } else if (index >= 0) {
            onOpen?.();
          }
        }}
      >
        <BottomSheetScrollView contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>{spaceName ? `${spaceName} chat goes here` : 'Chat goes here'}</Text>
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
    backgroundColor: '#E0E0E0',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#3A3A3C',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
});

export default SpaceChatSheet;


