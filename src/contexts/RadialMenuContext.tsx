import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Share, Alert, Modal } from 'react-native';
import { observer } from '@legendapp/state/react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { itemsActions } from '../stores/items';
import { chatUIActions } from '../stores/chatUI';
import { Item } from '../types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ActionButton {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action: (item: Item) => void;
}

interface RadialMenuContextType {
  showMenu: (item: Item, x: number, y: number) => void;
  hideMenu: () => void;
  updateHoveredButton: (x: number, y: number) => void;
  executeAction: () => void;
  isMenuVisible: boolean;
  shouldDisableScroll: boolean; // New: tells parent to disable scrolling
}

const RadialMenuContext = createContext<RadialMenuContextType | undefined>(undefined);

export const useRadialMenu = () => {
  const context = useContext(RadialMenuContext);
  if (!context) {
    throw new Error('useRadialMenu must be used within RadialMenuProvider');
  }
  return context;
};

const BUTTON_RADIUS = 80;
const BUTTON_SIZE = 56;
const ARC_ANGLE = 180;

interface RadialMenuOverlayProps {
  visible: boolean;
  item: Item | null;
  touchPosition: { x: number; y: number };
  hoveredButtonId: string | null;
  onHide: () => void;
  onExecuteAction: () => void;
}

const RadialMenuOverlay = observer(({
  visible,
  item,
  touchPosition,
  hoveredButtonId,
  onHide,
}: RadialMenuOverlayProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const overlayOpacity = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    overlayOpacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
  }, [visible]);

  const actionButtons: ActionButton[] = [
    {
      id: 'delete',
      label: 'Delete',
      icon: 'trash-outline',
      color: '#FF3B30',
      action: (item: Item) => {
        console.log('🗑️ DELETE button pressed for item:', item.title);
      },
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: 'chatbubble-outline',
      color: '#007AFF',
      action: (item: Item) => {
        console.log('💬 CHAT button pressed for item:', item.title);
      },
    },
    {
      id: 'share',
      label: 'Share',
      icon: 'share-outline',
      color: '#34C759',
      action: (item: Item) => {
        console.log('📤 SHARE button pressed for item:', item.title);
      },
    },
    {
      id: 'move',
      label: 'Move',
      icon: 'folder-outline',
      color: '#AF52DE',
      action: (item: Item) => {
        console.log('📁 MOVE button pressed for item:', item.title);
      },
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: 'archive-outline',
      color: '#FF9500',
      action: (item: Item) => {
        console.log('📦 ARCHIVE button pressed for item:', item.title);
      },
    },
  ];

  const getButtonPositions = useCallback((touchX: number, touchY: number) => {
    const positions: { x: number; y: number }[] = [];
    const isLeftSide = touchX < screenWidth / 2;
    const isUpperHalf = touchY < screenHeight / 2;

    let baseAngle = 0;
    if (isLeftSide && isUpperHalf) {
      baseAngle = -45;
    } else if (isLeftSide && !isUpperHalf) {
      baseAngle = 45;
    } else if (!isLeftSide && isUpperHalf) {
      baseAngle = -135;
    } else {
      baseAngle = 135;
    }

    const numberOfButtons = actionButtons.length;
    const angleStep = ARC_ANGLE / (numberOfButtons - 1);

    for (let i = 0; i < numberOfButtons; i++) {
      const angle = baseAngle + (i * angleStep);
      const radian = (angle * Math.PI) / 180;
      const x = touchX + BUTTON_RADIUS * Math.cos(radian);
      const y = touchY + BUTTON_RADIUS * Math.sin(radian);
      positions.push({ x, y });
    }

    return positions;
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const buttonPositions = visible ? getButtonPositions(touchPosition.x, touchPosition.y) : [];

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onHide}
    >
      <View style={styles.modalContainer} pointerEvents="box-none">
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" />

        {actionButtons.map((button, index) => {
          const position = buttonPositions[index];
          const isHovered = hoveredButtonId === button.id;

          return (
            <View
              key={button.id}
              style={[
                styles.actionButton,
                {
                  left: position.x - BUTTON_SIZE / 2,
                  top: position.y - BUTTON_SIZE / 2,
                  backgroundColor: button.color,
                  transform: [{ scale: isHovered ? 1.3 : 1.0 }],
                },
              ]}
              pointerEvents="none"
            >
              <Ionicons
                name={button.icon}
                size={isHovered ? 30 : 24}
                color="#FFFFFF"
              />
            </View>
          );
        })}
      </View>
    </Modal>
  );
});

export const RadialMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const [hoveredButtonId, setHoveredButtonId] = useState<string | null>(null);
  const [shouldDisableScroll, setShouldDisableScroll] = useState(false);

  const actionButtons: ActionButton[] = [
    {
      id: 'delete',
      label: 'Delete',
      icon: 'trash-outline',
      color: '#FF3B30',
      action: (item: Item) => {
        console.log('🗑️ DELETE button pressed for item:', item.title);
      },
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: 'chatbubble-outline',
      color: '#007AFF',
      action: (item: Item) => {
        console.log('💬 CHAT button pressed for item:', item.title);
      },
    },
    {
      id: 'share',
      label: 'Share',
      icon: 'share-outline',
      color: '#34C759',
      action: (item: Item) => {
        console.log('📤 SHARE button pressed for item:', item.title);
      },
    },
    {
      id: 'move',
      label: 'Move',
      icon: 'folder-outline',
      color: '#AF52DE',
      action: (item: Item) => {
        console.log('📁 MOVE button pressed for item:', item.title);
      },
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: 'archive-outline',
      color: '#FF9500',
      action: (item: Item) => {
        console.log('📦 ARCHIVE button pressed for item:', item.title);
      },
    },
  ];

  const getButtonPositions = useCallback((touchX: number, touchY: number) => {
    const positions: { x: number; y: number }[] = [];
    const isLeftSide = touchX < screenWidth / 2;
    const isUpperHalf = touchY < screenHeight / 2;

    let baseAngle = 0;
    if (isLeftSide && isUpperHalf) {
      baseAngle = -45;
    } else if (isLeftSide && !isUpperHalf) {
      baseAngle = 45;
    } else if (!isLeftSide && isUpperHalf) {
      baseAngle = -135;
    } else {
      baseAngle = 135;
    }

    const numberOfButtons = actionButtons.length;
    const angleStep = ARC_ANGLE / (numberOfButtons - 1);

    for (let i = 0; i < numberOfButtons; i++) {
      const angle = baseAngle + (i * angleStep);
      const radian = (angle * Math.PI) / 180;
      const x = touchX + BUTTON_RADIUS * Math.cos(radian);
      const y = touchY + BUTTON_RADIUS * Math.sin(radian);
      positions.push({ x, y });
    }

    return positions;
  }, []);

  const getHoveredButton = useCallback((touchX: number, touchY: number) => {
    const positions = getButtonPositions(touchPosition.x, touchPosition.y);
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const distance = Math.sqrt(
        Math.pow(touchX - pos.x, 2) + Math.pow(touchY - pos.y, 2)
      );
      if (distance < BUTTON_SIZE / 2) {
        return actionButtons[i].id;
      }
    }
    return null;
  }, [touchPosition, getButtonPositions]);

  const showMenu = useCallback((newItem: Item, x: number, y: number) => {
    console.log('📌 RadialMenu: Disabling parent scroll');
    setShouldDisableScroll(true); // Disable scroll when menu opens
    setItem(newItem);
    setTouchPosition({ x, y });
    setVisible(true);
  }, []);

  const hideMenu = useCallback(() => {
    console.log('📌 RadialMenu: Re-enabling parent scroll');
    setShouldDisableScroll(false); // Re-enable scroll when menu closes
    setTimeout(() => {
      setVisible(false);
      setHoveredButtonId(null);
      setItem(null);
    }, 200);
  }, []);

  const updateHoveredButton = useCallback((x: number, y: number) => {
    if (visible) {
      const hoveredId = getHoveredButton(x, y);
      if (hoveredId !== hoveredButtonId) {
        console.log('🎯 Hovered button changed:', hoveredId);
        setHoveredButtonId(hoveredId);
      }
    }
  }, [visible, hoveredButtonId, getHoveredButton]);

  const executeAction = useCallback(() => {
    console.log('🚀 Execute action - hoveredButtonId:', hoveredButtonId, 'item:', item?.title);
    if (hoveredButtonId && item) {
      const button = actionButtons.find(b => b.id === hoveredButtonId);
      if (button) {
        console.log('✨ Executing action for button:', button.label);
        button.action(item);
      } else {
        console.log('⚠️ No button found for id:', hoveredButtonId);
      }
    } else {
      console.log('ℹ️ No action to execute - no button hovered');
    }
  }, [hoveredButtonId, item]);

  const value: RadialMenuContextType = {
    showMenu,
    hideMenu,
    updateHoveredButton,
    executeAction,
    isMenuVisible: visible,
    shouldDisableScroll,
  };

  return (
    <RadialMenuContext.Provider value={value}>
      {children}
      <RadialMenuOverlay
        visible={visible}
        item={item}
        touchPosition={touchPosition}
        hoveredButtonId={hoveredButtonId}
        onHide={hideMenu}
        onExecuteAction={executeAction}
      />
    </RadialMenuContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  actionButton: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
