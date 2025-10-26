import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { spacesStore } from '../stores/spaces';
import { itemsActions } from '../stores/items';

interface SpaceSelectorProps {
  itemId: string;
  currentSpaceId: string | null;
  onSpaceChange?: (spaceId: string | null) => void;
}

export const SpaceSelector = observer(({ itemId, currentSpaceId, onSpaceChange }: SpaceSelectorProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(currentSpaceId);
  const spaces = spacesStore.spaces.get().filter(s => !s.is_deleted);

  const handleSpaceSelect = async (spaceId: string | null) => {
    setSelectedSpaceId(spaceId);
    await itemsActions.updateItemWithSync(itemId, { space_id: spaceId });
    onSpaceChange?.(spaceId);
  };

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isDarkMode && styles.labelDark]}>
        SPACES
      </Text>
      <TouchableOpacity
        style={[styles.selector, isDarkMode && styles.selectorDark]}
        onPress={() => setShowSpaceSelector(!showSpaceSelector)}
        activeOpacity={0.7}
      >
        {selectedSpace ? (
          <View style={styles.selectedSpaces}>
            <View style={styles.selectedSpaceTag}>
              <View
                style={[
                  styles.spaceTagDot,
                  { backgroundColor: selectedSpace.color }
                ]}
              />
              <Text style={[styles.spaceTagText, isDarkMode && styles.spaceTagTextDark]}>
                {selectedSpace.name}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.noSpace, isDarkMode && styles.noSpaceDark]}>
            📂 Everything (No Space)
          </Text>
        )}
        <Text style={styles.chevron}>{showSpaceSelector ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Space Options Dropdown */}
      {showSpaceSelector && (
        <View style={[styles.spaceOptions, isDarkMode && styles.spaceOptionsDark]}>
          {/* Everything Option */}
          <TouchableOpacity
            style={styles.spaceOption}
            onPress={() => handleSpaceSelect(null)}
          >
            <View style={styles.spaceOptionContent}>
              <View style={[
                styles.radioButton,
                selectedSpaceId === null && styles.radioButtonSelected
              ]}>
                {selectedSpaceId === null && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
              <Text style={[styles.spaceOptionText, isDarkMode && styles.spaceOptionTextDark]}>
                📂 Everything (No Space)
              </Text>
            </View>
          </TouchableOpacity>

          {/* Individual Spaces */}
          {spaces.map((space) => (
            <TouchableOpacity
              key={space.id}
              style={styles.spaceOption}
              onPress={() => handleSpaceSelect(space.id)}
            >
              <View style={styles.spaceOptionContent}>
                <View style={[
                  styles.radioButton,
                  selectedSpaceId === space.id && styles.radioButtonSelected,
                  selectedSpaceId === space.id && { borderColor: space.color }
                ]}>
                  {selectedSpaceId === space.id && (
                    <View style={[styles.radioButtonInner, { backgroundColor: space.color }]} />
                  )}
                </View>
                <View
                  style={[
                    styles.spaceColorDot,
                    { backgroundColor: space.color }
                  ]}
                />
                <Text style={[styles.spaceOptionText, isDarkMode && styles.spaceOptionTextDark]}>
                  {space.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  labelDark: {
    color: '#999',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectorDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#3A3A3C',
  },
  selectedSpaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  selectedSpaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 6,
  },
  spaceTagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  spaceTagText: {
    fontSize: 14,
    color: '#007AFF',
  },
  spaceTagTextDark: {
    color: '#64B5F6',
  },
  noSpace: {
    fontSize: 14,
    color: '#999',
    flex: 1,
  },
  noSpaceDark: {
    color: '#666',
  },
  chevron: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  spaceOptions: {
    marginTop: 8,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  spaceOptionsDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#3A3A3C',
  },
  spaceOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  spaceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  spaceColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  spaceOptionText: {
    fontSize: 14,
    color: '#333',
  },
  spaceOptionTextDark: {
    color: '#FFF',
  },
});
