import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Item } from '../types';
import { formatDate } from '../utils/itemCardHelpers';

interface ItemViewFooterProps {
  item: Item;
  onRefresh?: () => void;
  onShare?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  isRefreshing?: boolean;
  isDarkMode: boolean;
}

const ItemViewFooter: React.FC<ItemViewFooterProps> = ({
  item,
  onRefresh,
  onShare,
  onArchive,
  onDelete,
  isRefreshing = false,
  isDarkMode,
}) => {
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
      Alert.alert('Copied', 'URL copied to clipboard');
    }
  };

  return (
    <View style={styles.footer}>
      {/* Icon Buttons Row */}
      <View style={styles.actionsRow}>
        {item.url && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={handleCopyUrl}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>📋</Text>
          </TouchableOpacity>
        )}

        {item.url && onRefresh && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>{isRefreshing ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        )}

        {onShare && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onShare}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>📤</Text>
          </TouchableOpacity>
        )}

        {onArchive && (
          <TouchableOpacity
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={onArchive}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>📦</Text>
          </TouchableOpacity>
        )}

        {onDelete && (
          <TouchableOpacity
            style={[styles.iconButton, styles.deleteButton, isDarkMode && styles.deleteButtonDark]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Timestamp */}
      <View style={styles.timestampContainer}>
        <Text style={[styles.timestampText, isDarkMode && styles.timestampTextDark]}>
          This was saved {formatTimestamp(item.created_at)}
        </Text>
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
  iconText: {
    fontSize: 24,
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
});
