import React, { forwardRef, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { themeStore } from '../stores/theme';
import { chatUIStore, chatUIActions } from '../stores/chatUI';
import { aiSettingsComputed } from '../stores/aiSettings';
import { itemChatsActions, itemChatsComputed } from '../stores/itemChats';
import { chatMessagesActions, chatMessagesComputed } from '../stores/chatMessages';
import { buildItemContext, formatContextMetadata } from '../services/contextBuilder';
import { openai } from '../services/openai';
import { Item, ItemChat, ChatMessage } from '../types';
import { COLORS } from '../constants';

interface ChatSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
}

const ChatSheet = observer(
  forwardRef<BottomSheet, ChatSheetProps>(({ onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const insets = useSafeAreaInsets();
    const item = chatUIStore.currentItem.get();

    console.log('🎨 [ChatSheet] Render - item:', item?.id, item?.title);

    const [inputText, setInputText] = useState('');
    const [chat, setChat] = useState<ItemChat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // const snapPoints = useMemo(() => ['90%'], []);
    const snapPoints = ['90%'];
    const selectedModel = aiSettingsComputed.selectedModel();

    // Load or create chat when item changes
    useEffect(() => {
      if (item) {
        loadOrCreateChat();
      }
    }, [item?.id]);

    const loadOrCreateChat = async () => {
      if (!item) return;

      // Try to find existing chat
      let existingChat = itemChatsComputed.getChatByItemId(item.id);

      if (!existingChat) {
        // Create new chat
        existingChat = await itemChatsActions.createChat(item.id);
      }

      if (existingChat) {
        setChat(existingChat);
        // Load messages for this chat
        const chatMessages = await chatMessagesActions.loadMessagesForChat(existingChat.id);
        setMessages(chatMessages);
      }
    };

    // Scroll to bottom when messages change
    useEffect(() => {
      if (messages.length > 0) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }, [messages.length]);

    const handleSend = async () => {
      if (!inputText.trim() || !item || !chat || isTyping) return;

      const userMessage = inputText.trim();
      setInputText('');
      setIsTyping(true);

      try {
        // Add user message optimistically
        const userMsg = chatMessagesActions.addMessageOptimistic(
          chat.id,
          'item',
          'user',
          userMessage
        );
        setMessages(prev => [...prev, userMsg]);

        // Build context from item
        const { contextString, metadata } = buildItemContext(item);

        // Get previous messages for conversation history
        const previousMessages = messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        // Call OpenAI API
        const completion = await openai.chatWithContextEnhanced(
          contextString,
          userMessage,
          previousMessages,
          {
            model: selectedModel,
            temperature: 0.7,
            max_tokens: 1500,
          }
        );

        if (completion && completion.choices[0]) {
          const assistantMessage = completion.choices[0].message.content;
          const messageMetadata = {
            model: completion.model,
            tokens: {
              prompt: completion.usage.prompt_tokens,
              completion: completion.usage.completion_tokens,
              total: completion.usage.total_tokens,
            },
            timestamp: new Date().toISOString(),
            context_version: '1.0',
          };

          // Add assistant message
          const assistantMsg = chatMessagesActions.addMessageOptimistic(
            chat.id,
            'item',
            'assistant',
            assistantMessage,
            messageMetadata
          );
          setMessages(prev => [...prev, assistantMsg]);
        } else {
          // Show error message
          const errorMsg = chatMessagesActions.addMessageOptimistic(
            chat.id,
            'item',
            'assistant',
            'I apologize, but I could not generate a response at this time. Please try again.'
          );
          setMessages(prev => [...prev, errorMsg]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        const errorMsg = chatMessagesActions.addMessageOptimistic(
          chat.id,
          'item',
          'assistant',
          'An error occurred. Please check your API key and try again.'
        );
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    };

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    const renderSystemMessage = () => {
      if (!item) return null;

      const { metadata } = buildItemContext(item);
      const contextInfo = formatContextMetadata(metadata);

      return (
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessagePill, isDarkMode && styles.systemMessagePillDark]}>
            <Text style={[styles.systemMessageTitle, isDarkMode && styles.systemMessageTitleDark]}>
              💬 Chatting about: {item.title}
            </Text>
            <Text style={[styles.systemMessageSubtitle, isDarkMode && styles.systemMessageSubtitleDark]}>
              📄 Context: {contextInfo}
            </Text>
          </View>
        </View>
      );
    };

    const renderTypingIndicator = () => {
      return <TypingIndicator isDarkMode={isDarkMode} />;
    };

    const renderMessage = (message: ChatMessage, index: number) => {
      const isUser = message.role === 'user';
      const isSystem = message.role === 'system';

      if (isSystem) return null; // Don't render system messages

      const time = new Date(message.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const modelName = message.metadata?.model;

      return (
        <View
          key={message.id}
          style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isUser
                ? styles.userBubble
                : [styles.assistantBubble, isDarkMode && styles.assistantBubbleDark],
            ]}
          >
            <Text style={[
              styles.messageText,
              isUser && styles.userMessageText,
              !isUser && isDarkMode && styles.assistantMessageTextDark
            ]}>
              {message.content}
            </Text>
          </View>
          <Text style={[styles.messageTime, isDarkMode && styles.messageTimeDark]}>
            {modelName && !isUser && `${modelName} • `}
            {time}
          </Text>
        </View>
      );
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        topInset={50}
        keyboardBehavior="extend"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
        onChange={(index) => {
          if (index === -1) {
            onClose?.();
            chatUIActions.closeChat();
          } else if (index >= 0) {
            onOpen?.();
          }
        }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, isDarkMode && styles.headerDark]}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>AI Chat</Text>
            <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
              Powered by {selectedModel}
            </Text>
          </View>

          {/* Messages */}
          <BottomSheetScrollView
            ref={scrollViewRef as any}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
          >
            {renderSystemMessage()}

            {messages.map((msg, idx) => renderMessage(msg, idx))}

            {isTyping && renderTypingIndicator()}

            <View style={{ height: 20 }} />
          </BottomSheetScrollView>

          {/* Input Bar */}
          <View
            style={[
              styles.inputContainer,
              isDarkMode && styles.inputContainerDark,
              { paddingBottom: insets.bottom || 10 },
            ]}
          >
            <BottomSheetTextInput
              style={[
                styles.input,
                isDarkMode && styles.inputDark,
              ]}
              placeholder="Ask a question..."
              placeholderTextColor={isDarkMode ? '#666' : '#999'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!isTyping}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isTyping) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isTyping}
            >
              {isTyping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  })
);

// Typing Indicator Component
const TypingIndicator = observer(({ isDarkMode }: { isDarkMode: boolean }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dot: Animated.SharedValue<number>, delay: number) => {
      dot.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-8, { duration: 400, easing: Easing.ease }),
            withTiming(0, { duration: 400, easing: Easing.ease })
          ),
          -1,
          false
        )
      );
    };

    animateDot(dot1, 0);
    animateDot(dot2, 133);
    animateDot(dot3, 266);
  }, []);

  const animatedStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));

  const animatedStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));

  const animatedStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View style={styles.typingContainer}>
      <View style={[styles.typingBubble, isDarkMode && styles.typingBubbleDark]}>
        <Animated.View style={[styles.typingDot, animatedStyle1]} />
        <Animated.View style={[styles.typingDot, animatedStyle2]} />
        <Animated.View style={[styles.typingDot, animatedStyle3]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    elevation: 20, // Android shadow/z-index
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
    elevation: 20, // Android shadow/z-index
  },
  handleIndicator: {
    backgroundColor: '#CCCCCC',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#666666',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  headerDark: {
    borderBottomColor: '#38383A',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  subtitleDark: {
    color: '#999999',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  systemMessagePill: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '90%',
  },
  systemMessagePillDark: {
    backgroundColor: '#2C2C2E',
  },
  systemMessageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  systemMessageTitleDark: {
    color: '#FFFFFF',
  },
  systemMessageSubtitle: {
    fontSize: 11,
    color: '#666666',
    textAlign: 'center',
  },
  systemMessageSubtitleDark: {
    color: '#999999',
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
  },
  assistantBubble: {
    backgroundColor: '#E9E9EB',
  },
  assistantBubbleDark: {
    backgroundColor: '#3A3A3C',
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageTextDark: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#999999',
    marginTop: 4,
    marginHorizontal: 8,
  },
  messageTimeDark: {
    color: '#666666',
  },
  typingContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  typingBubble: {
    backgroundColor: '#E9E9EB',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingBubbleDark: {
    backgroundColor: '#3A3A3C',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
  },
  inputContainerDark: {
    backgroundColor: '#1C1C1E',
    borderTopColor: '#38383A',
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 16,
    color: '#000000',
    maxHeight: 100,
    marginRight: 8,
  },
  inputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default ChatSheet;
