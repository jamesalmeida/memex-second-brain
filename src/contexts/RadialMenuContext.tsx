import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Share, Alert, Modal } from 'react-native';
import { observer } from '@legendapp/state/react';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { themeStore } from '../stores/theme';
import { itemsActions } from '../stores/items';
import { chatUIActions } from '../stores/chatUI';
import { Item } from '../types';
import DefaultItemCard from '../components/items/DefaultItemCard';
import XItemCard from '../components/items/XItemCard';
import YoutubeItemCard from '../components/items/YoutubeItemCard';
import MovieTVItemCard from '../components/items/MovieTVItemCard';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ActionButton {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action: (item: Item) => void;
}

interface CardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RadialMenuContextType {
  showMenu: (item: Item, x: number, y: number, cardLayout: CardLayout) => void;
  hideMenu: () => void;
  updateHoveredButton: (x: number, y: number) => void;
  executeAction: () => void;
  isMenuVisible: boolean;
  activeItemId: string | null; // Track which specific item has menu open
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
const ARC_ANGLE = 110;

// Animated button component
const RadialButton: React.FC<{
  button: ActionButton;
  position: { x: number; y: number };
  touchPosition: { x: number; y: number };
  isHovered: boolean;
  visible: boolean;
}> = ({ button, position, touchPosition, isHovered, visible }) => {
  const scale = useSharedValue(1);
  const iconSize = useSharedValue(24);
  const opacity = useSharedValue(0);
  const hoverProgress = useSharedValue(0); // 0 = not hovered, 1 = hovered

  // Calculate the offset from touch point to final position
  const finalOffsetX = position.x - touchPosition.x;
  const finalOffsetY = position.y - touchPosition.y;

  // Animated position - starts at 0 (touch point), animates to final offset
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    if (isHovered) {
      // Instant scale-up and color change for immediate feedback
      scale.value = 1.3;
      iconSize.value = 30;
      hoverProgress.value = withTiming(1, {
        duration: 100,
        easing: Easing.out(Easing.ease),
      });
    } else {
      // Smooth scale-down and color change for polish
      scale.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
      iconSize.value = withTiming(24, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
      hoverProgress.value = withTiming(0, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [isHovered]);

  React.useEffect(() => {
    if (visible) {
      // Animate from touch point to final position
      translateX.value = withSpring(finalOffsetX, {
        damping: 60,
        stiffness: 700,
      });
      translateY.value = withSpring(finalOffsetY, {
        damping: 60,
        stiffness: 700,
      });
      opacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease),
      });
    } else {
      // Quick fade out and return to center when menu closes
      translateX.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      translateY.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      opacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [visible, finalOffsetX, finalOffsetY]);

  const animatedStyle = useAnimatedStyle(() => {
    // Push out 15% further when hovered
    const pushOutMultiplier = 1 + (hoverProgress.value * 0.15);

    return {
      transform: [
        { translateX: translateX.value * pushOutMultiplier },
        { translateY: translateY.value * pushOutMultiplier },
        { scale: scale.value },
      ],
      opacity: opacity.value,
      backgroundColor: interpolateColor(
        hoverProgress.value,
        [0, 1],
        ['#3A3A3C', '#FFFFFF'] // dark gray -> white
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.actionButton,
        {
          left: touchPosition.x - BUTTON_SIZE / 2,
          top: touchPosition.y - BUTTON_SIZE / 2,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={button.icon}
        size={isHovered ? 30 : 24}
        color={isHovered ? '#3A3A3C' : '#FFFFFF'}
      />
    </Animated.View>
  );
};

interface RadialMenuOverlayProps {
  visible: boolean;
  isClosing: boolean;
  item: Item | null;
  touchPosition: { x: number; y: number };
  cardLayout: CardLayout | null;
  hoveredButtonId: string | null;
  onHide: () => void;
  onExecuteAction: () => void;
}

const RadialMenuOverlay = observer(({
  visible,
  isClosing,
  item,
  touchPosition,
  cardLayout,
  hoveredButtonId,
  onHide,
}: RadialMenuOverlayProps) => {
  const isDarkMode = themeStore.isDarkMode.get();
  const overlayOpacity = useSharedValue(visible ? 1 : 0);

  React.useEffect(() => {
    overlayOpacity.value = withTiming(visible && !isClosing ? 1 : 0, { duration: 250 });
  }, [visible, isClosing]);

  // TODO: Add settings feature to let users choose which 3 buttons to show
  // Currently showing 3 buttons max to prevent finger from covering one during interaction
  const actionButtons: ActionButton[] = [
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
    // {
    //   id: 'move',
    //   label: 'Move',
    //   icon: 'folder-outline',
    //   color: '#AF52DE',
    //   action: (item: Item) => {
    //     console.log('📁 MOVE button pressed for item:', item.title);
    //   },
    // },
    {
      id: 'archive',
      label: 'Archive',
      icon: 'archive-outline',
      color: '#FF9500',
      action: (item: Item) => {
        console.log('📦 ARCHIVE button pressed for item:', item.title);
      },
    },
    // {
    //   id: 'delete',
    //   label: 'Delete',
    //   icon: 'trash-outline',
    //   color: '#FF3B30',
    //   action: (item: Item) => {
    //     console.log('🗑️ DELETE button pressed for item:', item.title);
    //   },
    // },
  ];

  const getButtonPositions = useCallback((touchX: number, touchY: number) => {
    const positions: { x: number; y: number }[] = [];
    const isLeftSide = touchX < screenWidth / 2;

    // Always above the finger, angled left or right
    let centerAngle = 0;
    if (isLeftSide) {
      centerAngle = -45;  // 45° to the right (upper-right)
    } else {
      centerAngle = -135; // 45° to the left (upper-left)
    }

    // Center the arc around the centerAngle
    const startAngle = centerAngle - (ARC_ANGLE / 2);
    const numberOfButtons = actionButtons.length;
    const angleStep = ARC_ANGLE / (numberOfButtons - 1);

    for (let i = 0; i < numberOfButtons; i++) {
      const angle = startAngle + (i * angleStep);
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
        {/* Overlay behind everything */}
        <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none" />

        {/* Floating card - render after overlay so it appears on top */}
        {item && cardLayout && (() => {
          // Render card directly without RadialActionMenu wrapper
          let CardComponent;
          switch (item.content_type) {
            case 'x':
              CardComponent = XItemCard;
              break;
            case 'youtube':
            case 'youtube_short':
              CardComponent = YoutubeItemCard;
              break;
            case 'movie':
            case 'tv_show':
              CardComponent = MovieTVItemCard;
              break;
            default:
              CardComponent = DefaultItemCard;
          }

          return (
            <View
              style={{
                position: 'absolute',
                left: cardLayout.x,
                top: cardLayout.y,
                width: cardLayout.width,
                height: cardLayout.height,
                transform: [
                  { scale: 1.05 },
                  { rotate: '2deg' },
                ],
                zIndex: 100,
              }}
              pointerEvents="none"
            >
              <CardComponent item={item} onPress={() => {}} disabled={true} />
            </View>
          );
        })()}

        {/* Buttons on top */}
        {actionButtons.map((button, index) => {
          const position = buttonPositions[index];
          const isHovered = hoveredButtonId === button.id;

          return (
            <RadialButton
              key={button.id}
              button={button}
              position={position}
              touchPosition={touchPosition}
              isHovered={isHovered}
              visible={!isClosing}
            />
          );
        })}
      </View>
    </Modal>
  );
});

export const RadialMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [item, setItem] = useState<Item | null>(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);
  const [hoveredButtonId, setHoveredButtonId] = useState<string | null>(null);
  const [shouldDisableScroll, setShouldDisableScroll] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // TODO: Add settings feature to let users choose which 3 buttons to show
  // Currently showing 3 buttons max to prevent finger from covering one during interaction
  const actionButtons: ActionButton[] = [
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
    // {
    //   id: 'move',
    //   label: 'Move',
    //   icon: 'folder-outline',
    //   color: '#AF52DE',
    //   action: (item: Item) => {
    //     console.log('📁 MOVE button pressed for item:', item.title);
    //   },
    // },
    {
      id: 'archive',
      label: 'Archive',
      icon: 'archive-outline',
      color: '#FF9500',
      action: (item: Item) => {
        console.log('📦 ARCHIVE button pressed for item:', item.title);
      },
    },
    // {
    //   id: 'delete',
    //   label: 'Delete',
    //   icon: 'trash-outline',
    //   color: '#FF3B30',
    //   action: (item: Item) => {
    //     console.log('🗑️ DELETE button pressed for item:', item.title);
    //   },
    // },
  ];

  const getButtonPositions = useCallback((touchX: number, touchY: number) => {
    const positions: { x: number; y: number }[] = [];
    const isLeftSide = touchX < screenWidth / 2;

    // Always above the finger, angled left or right
    let centerAngle = 0;
    if (isLeftSide) {
      centerAngle = -45;  // 45° to the right (upper-right)
    } else {
      centerAngle = -135; // 45° to the left (upper-left)
    }

    // Center the arc around the centerAngle
    const startAngle = centerAngle - (ARC_ANGLE / 2);
    const numberOfButtons = actionButtons.length;
    const angleStep = ARC_ANGLE / (numberOfButtons - 1);

    for (let i = 0; i < numberOfButtons; i++) {
      const angle = startAngle + (i * angleStep);
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
      // Moderately expanded hit area for responsive detection without overlap
      if (distance < BUTTON_SIZE * 1.1) {
        return actionButtons[i].id;
      }
    }
    return null;
  }, [touchPosition, getButtonPositions]);

  const showMenu = useCallback((newItem: Item, x: number, y: number, layout: CardLayout) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShouldDisableScroll(true); // Disable scroll when menu opens
    setIsClosing(false); // Reset closing state
    setItem(newItem);
    setTouchPosition({ x, y });
    setCardLayout(layout);
    setActiveItemId(newItem.id); // Track which item has menu open
    setVisible(true);
  }, []);

  const hideMenu = useCallback(() => {
    setShouldDisableScroll(false); // Re-enable scroll when menu closes
    setIsClosing(true); // Trigger fade animations immediately
    // Delay cleanup until fade animations complete
    setTimeout(() => {
      setVisible(false);
      setIsClosing(false);
      setHoveredButtonId(null);
      setItem(null);
      setCardLayout(null);
      setActiveItemId(null);
    }, 250);
  }, []);

  const updateHoveredButton = useCallback((x: number, y: number) => {
    if (visible) {
      const hoveredId = getHoveredButton(x, y);
      if (hoveredId !== hoveredButtonId) {
        console.log('🎯 Hovered button changed:', hoveredId);
        if (hoveredId) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    activeItemId,
    shouldDisableScroll,
  };

  return (
    <RadialMenuContext.Provider value={value}>
      {children}
      <RadialMenuOverlay
        visible={visible}
        isClosing={isClosing}
        item={item}
        touchPosition={touchPosition}
        cardLayout={cardLayout}
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
    backgroundColor: 'rgba(0, 0, 0, 1)', // 100% dark overlay
    zIndex: 1,
  },
  cardCutout: {
    // Placeholder for potential card cutout effect
  },
  floatingCard: {
    position: 'absolute',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 999,
    zIndex: 100,
    backgroundColor: 'transparent',
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
    zIndex: 200,
  },
});
