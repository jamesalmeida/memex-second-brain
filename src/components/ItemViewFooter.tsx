import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Item } from '../types';
import { formatDate } from '../utils/itemCardHelpers';
import { useToast } from '../contexts/ToastContext';

interface ItemViewFooterProps {
  item: Item;
  onRefresh?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
  isRefreshing?: boolean;
  isDarkMode: boolean;
}

const ItemViewFooter: React.FC<ItemViewFooterProps> = ({
  item,
  onRefresh,
  onShare,
  onArchive,
  onUnarchive,
  onDelete,
  isRefreshing = false,
  isDarkMode,
}) => {
  const { showToast } = useToast();

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyUrl = async () => {
    if (item.url) {
      await Clipboard.setStringAsync(item.url);
      showToast({ message: 'URL copied to clipboard', type: 'success' });
    }
  };

  return (
    <View style={styles.footer}>
      {/* Icon Buttons Row */}
      <View style={styles.actionsRow}>
        {item.url && onRefresh && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
            ) : (
              <MaterialIcons
                name="refresh"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
              />
            )}
          </TouchableOpacity>
        )}

        {item.url && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={handleCopyUrl}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="content-copy"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
        )}

        {onShare && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onShare}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="share"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
        )}

        {item.is_archived && onUnarchive ? (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onUnarchive}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="unarchive"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
        ) : onArchive && !item.is_archived ? (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onArchive}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="archive"
              size={24}
              color={isDarkMode ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
        ) : null}

        {onDelete && (
          <TouchableOpacity
            style={[styles.iconButton, styles.deleteButton, isDarkMode && styles.deleteButtonDark]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="delete-forever"
              size={24}
              color="#FF3B30"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Timestamp */}
      <View style={styles.timestampContainer}>
        <Text style={[styles.timestampText, isDarkMode && styles.timestampTextDark]}>
          This was saved {formatTimestamp(item.created_at)}
        </Text>
        {item.is_archived && item.archived_at && (
          <Text style={[styles.archivedText, isDarkMode && styles.archivedTextDark]}>
            {item.auto_archived ? 'Auto-archived' : 'Archived'} {formatTimestamp(item.archived_at)}
          </Text>
        )}
      </View>
    </View>
  );
};

export default ItemViewFooter;

const styles = StyleSheet.create({
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  iconButtonDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
  },
  deleteButtonDark: {
    backgroundColor: '#3A2020',
    borderColor: '#5A3030',
  },
  timestampContainer: {
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  timestampTextDark: {
    color: '#98989F',
  },
  archivedText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  archivedTextDark: {
    color: '#98989F',
  },
});
