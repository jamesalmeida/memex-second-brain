import React, { useEffect, useMemo, useCallback, forwardRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { Item } from '../types';
import RedditItemView from './itemViews/RedditItemView';
import YouTubeItemView from './itemViews/YouTubeItemView';
import XItemView from './itemViews/XItemView';
import MovieTVItemView from './itemViews/MovieTVItemView';
import DefaultItemView from './itemViews/DefaultItemView';
import NoteItemView from './itemViews/NoteItemView';
import PodcastItemView from './itemViews/PodcastItemView';
import LoadingModal from './LoadingModal';

interface ExpandedItemViewProps {
  item: Item | null;
  onClose?: () => void;
  onOpen?: () => void;
  onChat?: (item: Item) => void;
  onEdit?: (item: Item) => void;
  onArchive?: (item: Item) => void;
  onUnarchive?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onShare?: (item: Item) => void;
  onSpaceChange?: (item: Item, spaceId: string | null) => void;
  currentSpaceId?: string | null;
  isUnarchiving?: boolean;
  isArchiving?: boolean;
  isDeleting?: boolean;
  isRefreshing?: boolean;
}

const ExpandedItemView = observer(
  forwardRef<BottomSheet, ExpandedItemViewProps>(({
  item,
  onClose,
  onOpen,
  onChat,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onShare,
  onSpaceChange,
  currentSpaceId,
  isUnarchiving = false,
  isArchiving = false,
  isDeleting = false,
  isRefreshing = false,
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
  const snapPoints = useMemo(() => ['100%'], []);

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

    const commonProps = {
      item,
      onClose,
      onChat,
      onArchive,
      onUnarchive,
      onDelete,
      onShare,
      currentSpaceId,
      isDeleting,
      isRefreshing,
    };

    switch (item.content_type) {
      case 'note':
        return <NoteItemView {...commonProps} />;
      case 'reddit':
        return <RedditItemView {...commonProps} />;
      case 'youtube':
      case 'youtube_short':
        return <YouTubeItemView {...commonProps} />;
      case 'x':
        return <XItemView {...commonProps} />;
      case 'movie':
      case 'tv_show':
        return <MovieTVItemView {...commonProps} />;
      case 'podcast':
        return <PodcastItemView {...commonProps} />;
      default:
        return <DefaultItemView {...commonProps} />;
    }
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      topInset={51}
      backgroundStyle={[
        styles.sheetBackground,
        isDarkMode && styles.sheetBackgroundDark,
      ]}
      handleIndicatorStyle={{ display: 'none' }}
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

      {/* Loading Modal for various operations */}
      <LoadingModal
        visible={isUnarchiving || isArchiving || isDeleting || isRefreshing}
        text={
          isArchiving ? 'Archiving...' :
          isUnarchiving ? 'Unarchiving...' :
          isDeleting ? 'Deleting...' :
          isRefreshing ? 'Refreshing...' :
          'Loading...'
        }
        isDarkMode={isDarkMode}
      />
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
  scrollContent: {
    paddingBottom: 20,
  },
});
