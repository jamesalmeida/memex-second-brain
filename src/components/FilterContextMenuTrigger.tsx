import React, { ReactNode, useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { observer } from '@legendapp/state/react';
import { Host, ContextMenu, Button, Submenu, Switch } from '@expo/ui/swift-ui';
import { filterStore, filterActions } from '../stores/filter';
import { CONTENT_TYPES } from '../constants';
import { ContentType } from '../types';
import { itemsStore } from '../stores/items';

interface FilterContextMenuTriggerProps {
  children: ReactNode;
  hostStyle?: StyleProp<ViewStyle>;
}

const FilterContextMenuTriggerComponent = ({ children, hostStyle }: FilterContextMenuTriggerProps) => {
  const sortOrder = filterStore.sortOrder.get();
  const selectedContentType = filterStore.selectedContentType.get();
  const selectedTags = filterStore.selectedTags.get();
  const allItems = itemsStore.items.get();

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    allItems.forEach(item => {
      item.tags?.forEach(tag => {
        const trimmed = tag?.trim();
        if (trimmed) {
          tagSet.add(trimmed);
        }
      });
    });
    // ContextMenu renders items from bottom to top, so reverse after sorting A→Z.
    return Array.from(tagSet)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .reverse();
  }, [allItems]);

  return (
    <Host style={hostStyle}>
      <ContextMenu>
        <ContextMenu.Trigger>
          {children}
        </ContextMenu.Trigger>

        <ContextMenu.Items>
          <Button onPress={() => filterActions.clearAll()}>
            Reset
          </Button>

          <Button onPress={() => filterActions.setSortOrder('recent')}>
            {sortOrder === 'recent' ? '✓ Recently Added' : 'Recently Added'}
          </Button>
          <Button onPress={() => filterActions.setSortOrder('oldest')}>
            {sortOrder === 'oldest' ? '✓ Oldest First' : 'Oldest First'}
          </Button>

          <Submenu button={<Button>Type</Button>}>
            {(Object.keys(CONTENT_TYPES) as ContentType[]).map((contentType) => {
              const isSelected = selectedContentType === contentType;
              const config = CONTENT_TYPES[contentType];
              return (
                <Button
                  key={contentType}
                  onPress={() => filterActions.selectContentType(contentType)}
                >
                  {isSelected ? `✓ ${config.label}` : config.label}
                </Button>
              );
            })}
            {selectedContentType !== null && (
              <Button onPress={() => filterActions.clearContentType()}>
                Clear
              </Button>
            )}
          </Submenu>

          <Submenu button={<Button>Tags</Button>}>
            {availableTags.length === 0 && (
              <Button onPress={() => {}}>
                No tags yet
              </Button>
            )}
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Switch
                  key={tag}
                  variant="checkbox"
                  label={tag}
                  value={isSelected}
                  onValueChange={() => filterActions.toggleTag(tag)}
                />
              );
            })}
            {selectedTags.length > 0 && (
              <Button onPress={() => filterActions.clearTags()}>
                Clear All
              </Button>
            )}
          </Submenu>
        </ContextMenu.Items>
      </ContextMenu>
    </Host>
  );
};

export const FilterContextMenuTrigger = observer(FilterContextMenuTriggerComponent);
