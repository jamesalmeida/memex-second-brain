import React, { useEffect, useMemo, useCallback, forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { Item } from '../types';
import RedditItemView from './itemViews/RedditItemView';
import YouTubeItemView from './itemViews/YouTubeItemView';
import XItemView from './itemViews/XItemView';
import MovieTVItemView from './itemViews/MovieTVItemView';
import DefaultItemView from './itemViews/DefaultItemView';

interface ExpandedItemViewProps {
  item: Item | null;
  onClose?: () => void;
  onOpen?: () => void;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  onSpaceChange?: (item: Item, spaceId: string | null) => void;
  currentSpaceId?: string | null;
}

const ExpandedItemView = observer(
  forwardRef<BottomSheet, ExpandedItemViewProps>(({
  item,
  onClose,
  onOpen,
  onChat,
  onEdit,
  onArchive,
  onDelete,
  onShare,
  onSpaceChange,
  currentSpaceId,
}, ref) => {
  const isDarkMode = themeStore.isDarkMode.get();

  // Open sheet when item changes
  useEffect(() => {
    console.log('📄 [ExpandedItemView] useEffect - item changed:', item?.title || 'null');
    if (item && ref && 'current' in ref && ref.current) {
      console.log('📄 [ExpandedItemView] Opening sheet via snapToIndex(0)');
      ref.current.snapToIndex(0);
    }
  }, [item, ref]);

  // Bottom sheet configuration
  const snapPoints = useMemo(() => ['94%'], []);

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.9}
      />
    ),
    []
  );

  // Render the appropriate item view based on content type
  const renderItemView = () => {
    if (!item) return null;

    switch (item.content_type) {
      case 'reddit':
        return (
          <RedditItemView
            item={item}
            onChat={onChat}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onShare={onShare}
            currentSpaceId={currentSpaceId}
          />
        );

      case 'youtube':
      case 'youtube_short':
        return (
          <YouTubeItemView
            item={item}
            onChat={onChat}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onShare={onShare}
            currentSpaceId={currentSpaceId}
          />
        );

      case 'x':
        return (
          <XItemView
            item={item}
            onChat={onChat}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onShare={onShare}
            currentSpaceId={currentSpaceId}
          />
        );

      case 'movie':
      case 'tv_show':
        return (
          <MovieTVItemView
            item={item}
            onChat={onChat}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onShare={onShare}
            currentSpaceId={currentSpaceId}
          />
        );

      default:
        return (
          <DefaultItemView
            item={item}
            onChat={onChat}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
            onShare={onShare}
            currentSpaceId={currentSpaceId}
          />
        );
    }
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
      onChange={(index) => {
        console.log('📄 [ExpandedItemView] onChange - index:', index);
        if (index === -1) {
          console.log('📄 [ExpandedItemView] Sheet closed - calling onClose');
          onClose?.();
        } else if (index >= 0) {
          console.log('📄 [ExpandedItemView] Sheet opened - calling onOpen');
          onOpen?.();
        }
      }}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderItemView()}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}));

export default ExpandedItemView;

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
  scrollContent: {
    paddingBottom: 20,
  },
});
