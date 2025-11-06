import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useObservable } from '@legendapp/state/react';
import { themeStore } from '../stores/themeStore';

export interface SharedBottomSheetProps {
  snapPoints: (string | number)[];
  initialIndex?: number;
  enablePanDownToClose?: boolean;
  keyboardBehavior?: 'extend' | 'interactive' | 'fillParent';
  keyboardBlurBehavior?: 'none' | 'restore';
  android_keyboardInputMode?: 'adjustResize' | 'adjustPan';
  backdropOpacity?: number;
  onClose?: () => void;
  onChange?: (index: number) => void;
  children: React.ReactNode;
  zIndex?: number;
}

/**
 * SharedBottomSheet - A reusable bottom sheet component with consistent styling
 *
 * Features:
 * - Automatic light/dark mode styling
 * - Customizable snap points
 * - Optional keyboard handling
 * - Backdrop with configurable opacity
 * - Exposed imperative methods (snapToIndex, expand, close, etc.)
 *
 * Usage:
 * ```tsx
 * const sheetRef = useRef<BottomSheet>(null);
 *
 * <SharedBottomSheet
 *   ref={sheetRef}
 *   snapPoints={['30%', '70%']}
 *   keyboardBehavior="extend"
 *   onClose={() => console.log('Sheet closed')}
 * >
 *   <YourContent />
 * </SharedBottomSheet>
 * ```
 */
export const SharedBottomSheet = forwardRef<BottomSheet, SharedBottomSheetProps>(
  (
    {
      snapPoints,
      initialIndex = -1,
      enablePanDownToClose = true,
      keyboardBehavior,
      keyboardBlurBehavior,
      android_keyboardInputMode,
      backdropOpacity = 0.5,
      onClose,
      onChange,
      children,
      zIndex = 500,
    },
    ref
  ) => {
    const isDarkMode = useObservable(themeStore.isDarkMode);

    const memoizedSnapPoints = useMemo(() => snapPoints, [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={backdropOpacity}
        />
      ),
      [backdropOpacity]
    );

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1 && onClose) {
          onClose();
        }
        if (onChange) {
          onChange(index);
        }
      },
      [onClose, onChange]
    );

    return (
      <BottomSheet
        ref={ref}
        index={initialIndex}
        snapPoints={memoizedSnapPoints}
        enablePanDownToClose={enablePanDownToClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
        onChange={handleSheetChanges}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior={keyboardBlurBehavior}
        android_keyboardInputMode={android_keyboardInputMode}
        style={{ zIndex }}
      >
        {children}
      </BottomSheet>
    );
  }
);

SharedBottomSheet.displayName = 'SharedBottomSheet';

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#D1D1D6',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#48484A',
  },
});
