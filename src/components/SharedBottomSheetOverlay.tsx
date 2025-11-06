import React, { forwardRef } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';
import { SharedBottomSheet, SharedBottomSheetProps } from './SharedBottomSheet';

export interface SharedBottomSheetOverlayProps extends Omit<SharedBottomSheetProps, 'zIndex'> {
  /**
   * Override the default z-index if needed (default: 1000)
   */
  zIndex?: number;
}

/**
 * SharedBottomSheetOverlay - A variant of SharedBottomSheet for overlay contexts
 *
 * This component is designed for bottom sheets that need to appear above other bottom sheets,
 * such as chat interfaces that overlay on top of item detail views.
 *
 * Features:
 * - Higher z-index (1000) to appear above standard bottom sheets (500)
 * - Higher backdrop opacity (0.7) for better visual separation
 * - All other features from SharedBottomSheet
 *
 * Usage:
 * ```tsx
 * const chatSheetRef = useRef<BottomSheet>(null);
 *
 * <SharedBottomSheetOverlay
 *   ref={chatSheetRef}
 *   snapPoints={['90%']}
 *   keyboardBehavior="extend"
 * >
 *   <ChatContent />
 * </SharedBottomSheetOverlay>
 * ```
 */
export const SharedBottomSheetOverlay = forwardRef<BottomSheet, SharedBottomSheetOverlayProps>(
  ({ backdropOpacity = 0.7, zIndex = 1000, ...props }, ref) => {
    return (
      <SharedBottomSheet
        ref={ref}
        backdropOpacity={backdropOpacity}
        zIndex={zIndex}
        {...props}
      />
    );
  }
);

SharedBottomSheetOverlay.displayName = 'SharedBottomSheetOverlay';
