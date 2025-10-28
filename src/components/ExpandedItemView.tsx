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

    switch (item.content_type) {
      case 'note':
        return (
          <NoteItemView
            item={item}
            onChat={onChat}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onDelete={onDelete}
            onShare={onShare}
            currentSpaceId={currentSpaceId}
          />
        );
      case 'reddit':
        return (
          <RedditItemView
            item={item}
            onChat={onChat}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
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
            onArchive={onArchive}
            onUnarchive={onUnarchive}
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
            onArchive={onArchive}
            onUnarchive={onUnarchive}
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
            onArchive={onArchive}
            onUnarchive={onUnarchive}
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
            onArchive={onArchive}
            onUnarchive={onUnarchive}
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
      topInset={51}
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

      {/* Loading Overlay for Archiving/Unarchiving */}
      {(isUnarchiving || isArchiving) && (
        <View style={[styles.loadingOverlay, isDarkMode && styles.loadingOverlayDark]}>
          <View style={[styles.loadingContent, isDarkMode && styles.loadingContentDark]}>
            <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#007AFF'} />
            <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
              {isArchiving ? 'Archiving...' : 'Unarchiving...'}
            </Text>
          </View>
        </View>
      )}
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
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingOverlayDark: {
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingContentDark: {
    backgroundColor: '#2C2C2E',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  loadingTextDark: {
    color: '#FFFFFF',
  },
});
