import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
  Keyboard,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Host, ContextMenu, Button } from '@expo/ui/swift-ui';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
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
import { aiSettingsComputed } from '../stores/aiSettings';
import {
  assistantStore,
  assistantActions,
  assistantComputed,
  AssistantMessage,
} from '../stores/assistant';
import { openai } from '../services/openai';
import {
  ASSISTANT_TOOLS,
  ARCHITECT_TOOLS,
  ASSISTANT_SYSTEM_PROMPT_WITH_TOOLS,
  ARCHITECT_SYSTEM_PROMPT,
  executeTool,
  isArchitectCommand,
  extractArchitectMessage,
} from '../services/assistantTools';
import { useToast } from '../contexts/ToastContext';
import { COLORS } from '../constants';
import { Item } from '../types';
import ItemCard from './items/ItemCard';
import { expandedItemUIActions } from '../stores/expandedItemUI';

// Maximum number of tool call rounds to prevent infinite loops
const MAX_TOOL_ROUNDS = 5;

const AssistantChat = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [inputText, setInputText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showManualSuggestions, setShowManualSuggestions] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const messages = assistantComputed.currentMessages();
  const isSending = assistantStore.isSending.get();
  const selectedModel = aiSettingsComputed.selectedModel();

  // Initialize conversation on mount
  useEffect(() => {
    assistantActions.ensureConversation();
  }, []);

  // Track keyboard visibility for input positioning
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = async (messageText: string) => {
    const rawMessage = messageText.trim();
    assistantActions.setSending(true);

    // Check if this is an architect command
    const isArchitect = isArchitectCommand(rawMessage);
    const userMessage = isArchitect ? extractArchitectMessage(rawMessage) : rawMessage;
    const displayMessage = isArchitect ? `/architect ${userMessage}` : userMessage;

    // Select tools and system prompt based on mode
    const tools = isArchitect ? ARCHITECT_TOOLS : ASSISTANT_TOOLS;
    const baseSystemPrompt = isArchitect ? ARCHITECT_SYSTEM_PROMPT : ASSISTANT_SYSTEM_PROMPT_WITH_TOOLS;

    if (isArchitect) {
      console.log('[AssistantChat] Architect mode activated');
    }

    try {
      // Ensure we have a conversation
      await assistantActions.ensureConversation();

      // Add user message (show the full command including /architect)
      await assistantActions.addMessage({
        role: 'user',
        content: displayMessage,
      });

      // Build messages array for API with tools
      const currentMessages = assistantComputed.currentMessages();
      const systemPrompt = baseSystemPrompt.replace(
        '{{CURRENT_TIME}}',
        new Date().toISOString()
      );

      // Start the agentic loop
      let apiMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...currentMessages.map(m => ({
          role: m.role,
          // Strip /architect prefix from user messages when sending to API
          content: m.role === 'user' && isArchitectCommand(m.content)
            ? extractArchitectMessage(m.content)
            : m.content,
        })),
      ];

      let toolRounds = 0;
      let finalResponse: string | null = null;
      let finalModel: string | null = null;
      let finalTokens: { prompt: number; completion: number; total: number } | null = null;
      let itemsToDisplay: any[] = [];

      // Agentic loop - continue until we get a non-tool response or hit max rounds
      while (toolRounds < MAX_TOOL_ROUNDS) {
        console.log(`[AssistantChat] Tool round ${toolRounds + 1}/${MAX_TOOL_ROUNDS}`);

        // Call OpenAI API with tools (architect mode uses extended tools)
        const completion = await openai.createChatCompletionWithTools(
          apiMessages,
          tools,
          {
            model: selectedModel,
            temperature: 0.7,
            max_tokens: 1500,
          }
        );

        if (!completion) {
          throw new Error('Failed to get completion from OpenAI');
        }

        const choice = completion.choices?.[0];
        if (!choice) {
          throw new Error('No choice in completion');
        }

        // Check if the model wants to call tools
        if (completion.tool_calls && completion.tool_calls.length > 0) {
          console.log('[AssistantChat] Processing tool calls:', completion.tool_calls.map(tc => tc.function.name).join(', '));

          // Add assistant message with tool calls to the conversation
          apiMessages.push({
            role: 'assistant',
            content: choice.message?.content || null,
            tool_calls: completion.tool_calls,
          });

          // Execute each tool and add results
          for (const toolCall of completion.tool_calls) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              console.log(`[AssistantChat] Executing tool: ${toolCall.function.name}`, args);

              const result = await executeTool(toolCall.function.name, args);
              console.log(`[AssistantChat] Tool result:`, result.substring(0, 200));

              // Check if this is a search_items result with items to display
              if (toolCall.function.name === 'search_items') {
                try {
                  const parsedResult = JSON.parse(result);
                  if (parsedResult.items && parsedResult.items.length > 0 && parsedResult.display_as_cards) {
                    itemsToDisplay = parsedResult.items;
                    console.log('[AssistantChat] Found items to display as cards:', itemsToDisplay.length);
                  }
                } catch (parseError) {
                  console.error('[AssistantChat] Error parsing tool result:', parseError);
                }
              }

              // Add tool result to messages
              apiMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result,
              });
            } catch (toolError) {
              console.error(`[AssistantChat] Tool execution error:`, toolError);
              apiMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({ error: 'Tool execution failed' }),
              });
            }
          }

          toolRounds++;
        } else {
          // No tool calls - we have the final response
          finalResponse = choice.message?.content || 'I apologize, but I could not generate a response.';
          finalModel = completion.model;
          finalTokens = completion.usage ? {
            prompt: completion.usage.prompt_tokens,
            completion: completion.usage.completion_tokens,
            total: completion.usage.total_tokens,
          } : null;
          break;
        }
      }

      // If we hit max rounds without a final response, make one more call without tools
      if (!finalResponse) {
        console.log('[AssistantChat] Hit max tool rounds, getting final response');
        const finalCompletion = await openai.createChatCompletion(apiMessages, {
          model: selectedModel,
          temperature: 0.7,
          max_tokens: 1500,
        });

        if (finalCompletion && finalCompletion.choices[0]) {
          finalResponse = finalCompletion.choices[0].message.content;
          finalModel = finalCompletion.model;
          finalTokens = finalCompletion.usage ? {
            prompt: finalCompletion.usage.prompt_tokens,
            completion: finalCompletion.usage.completion_tokens,
            total: finalCompletion.usage.total_tokens,
          } : null;
        }
      }

      if (finalResponse) {
        // Add assistant response with items metadata if available
        await assistantActions.addMessage({
          role: 'assistant',
          content: finalResponse,
          metadata: {
            model: finalModel || selectedModel,
            tokens: finalTokens || undefined,
            items: itemsToDisplay.length > 0 ? itemsToDisplay : undefined,
          },
        });

        // Auto-generate title if this is the first exchange
        if (currentMessages.length === 1) {
          const title = userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : '');
          const conversation = assistantComputed.currentConversation();
          if (conversation) {
            await assistantActions.updateTitle(conversation.id, title);
          }
        }
      } else {
        await assistantActions.addMessage({
          role: 'assistant',
          content: 'I apologize, but I could not generate a response at this time. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      await assistantActions.addMessage({
        role: 'assistant',
        content: 'An error occurred. Please check your API key and try again.',
      });
    } finally {
      assistantActions.setSending(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    setInputText('');
    await sendMessage(inputText.trim());
  };

  const handleSuggestionPress = async (suggestion: string) => {
    if (isSending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage(suggestion);
  };

  const handleNewChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    assistantActions.startNewChat();
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all messages in this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            assistantActions.clearCurrentConversation();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast({
              message: 'Chat cleared',
              type: 'success',
              duration: 2000,
            });
          },
        },
      ]
    );
  };

  const handleShareChat = async () => {
    const currentConversation = assistantComputed.currentConversation();
    if (!currentConversation || messages.length === 0) {
      showToast({
        message: 'No messages to share',
        type: 'error',
        duration: 2000,
      });
      return;
    }

    try {
      // Format the conversation
      let shareText = `Chat: ${currentConversation.title || 'New Chat'}\n`;
      shareText += `Date: ${new Date().toLocaleDateString()}\n`;
      shareText += `Model: ${selectedModel}\n`;
      shareText += `\n${'='.repeat(50)}\n\n`;

      messages.forEach((msg) => {
        if (msg.role !== 'system') {
          const timestamp = new Date(msg.created_at).toLocaleTimeString();
          const sender = msg.role === 'user' ? 'You' : 'AI';
          shareText += `[${timestamp}] ${sender}:\n${msg.content}\n\n`;
        }
      });

      // Share text using iOS share sheet
      const result = await Share.share({
        message: shareText,
      });

      if (result.action === Share.sharedAction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error sharing chat:', error);
      showToast({
        message: 'Failed to share chat',
        type: 'error',
        duration: 2000,
      });
    }
  };

  const handleExportChat = async () => {
    const currentConversation = assistantComputed.currentConversation();
    if (!currentConversation || messages.length === 0) {
      showToast({
        message: 'No messages to export',
        type: 'error',
        duration: 2000,
      });
      return;
    }

    try {
      // Format the conversation
      let exportText = `Chat: ${currentConversation.title || 'New Chat'}\n`;
      exportText += `Date: ${new Date().toLocaleDateString()}\n`;
      exportText += `Model: ${selectedModel}\n`;
      exportText += `\n${'='.repeat(50)}\n\n`;

      messages.forEach((msg) => {
        if (msg.role !== 'system') {
          const timestamp = new Date(msg.created_at).toLocaleTimeString();
          const sender = msg.role === 'user' ? 'You' : 'AI';
          exportText += `[${timestamp}] ${sender}:\n${msg.content}\n\n`;
        }
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        // Fallback to copying to clipboard
        await Clipboard.setStringAsync(exportText);
        showToast({
          message: 'Sharing not available. Copied to clipboard instead.',
          type: 'success',
          duration: 3000,
        });
        return;
      }

      // Create a temporary file and share it
      const file = new File(Paths.document, 'assistant-chat-export.txt');
      if (file.exists) {
        file.delete();
      }
      file.create();
      file.write(exportText);
      await Sharing.shareAsync(file.uri);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error exporting chat:', error);
      showToast({
        message: 'Failed to export chat',
        type: 'error',
        duration: 2000,
      });
    }
  };

  const handleCopyToClipboard = async () => {
    const currentConversation = assistantComputed.currentConversation();
    if (!currentConversation || messages.length === 0) {
      showToast({
        message: 'No messages to copy',
        type: 'error',
        duration: 2000,
      });
      return;
    }

    try {
      // Format the conversation
      let copyText = `Chat: ${currentConversation.title || 'New Chat'}\n`;
      copyText += `Date: ${new Date().toLocaleDateString()}\n`;
      copyText += `Model: ${selectedModel}\n`;
      copyText += `\n${'='.repeat(50)}\n\n`;

      messages.forEach((msg) => {
        if (msg.role !== 'system') {
          const timestamp = new Date(msg.created_at).toLocaleTimeString();
          const sender = msg.role === 'user' ? 'You' : 'AI';
          copyText += `[${timestamp}] ${sender}:\n${msg.content}\n\n`;
        }
      });

      // Copy to clipboard
      await Clipboard.setStringAsync(copyText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({
        message: 'Chat copied to clipboard',
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error copying chat:', error);
      showToast({
        message: 'Failed to copy chat',
        type: 'error',
        duration: 2000,
      });
    }
  };

  const handleRenameChat = () => {
    const currentConversation = assistantComputed.currentConversation();
    if (!currentConversation) return;

    const currentTitle = currentConversation.title || 'New Chat';

    Alert.prompt(
      'Rename Chat',
      'Enter a new name for this chat:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rename',
          onPress: (newTitle: string | undefined) => {
            if (newTitle && newTitle.trim()) {
              assistantActions.updateTitle(currentConversation.id, newTitle.trim());
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showToast({
                message: 'Chat renamed',
                type: 'success',
                duration: 2000,
              });
            }
          },
        },
      ],
      'plain-text',
      currentTitle
    );
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await Clipboard.setStringAsync(content);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      showToast({
        message: 'Message copied',
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error copying message:', error);
    }
  };

  const handleItemPress = (item: Item) => {
    console.log('[AssistantChat] Item pressed:', item.id);
    expandedItemUIActions.expandItem(item);
  };

  const renderMessage = (message: AssistantMessage, index: number) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    if (isSystem) return null;

    const time = new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <MessageBubble
        key={message.id}
        message={message}
        isUser={isUser}
        isDarkMode={isDarkMode}
        time={time}
        onCopy={handleCopyMessage}
        onItemPress={handleItemPress}
      />
    );
  };

  const renderWelcome = () => {
    const suggestions = [
      'What have I saved recently?',
      'Help me organize my saved items',
      'What features can you help me with?',
      '/architect Show me memory stats',
      'Search my bookmarks for AI articles',
      'Suggest items I should review',
    ];

    return (
      <View style={styles.welcomeContainer}>
        <Text style={[styles.welcomeTitle, isDarkMode && styles.welcomeTitleDark]}>
          Memex Assistant
        </Text>
        <Text style={[styles.welcomeSubtitle, isDarkMode && styles.welcomeSubtitleDark]}>
          Your personal AI assistant for knowledge management
        </Text>
        <View style={styles.suggestionContainer}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.suggestionPill, isDarkMode && styles.suggestionPillDark]}
              onPress={() => handleSuggestionPress(suggestion)}
              disabled={isSending}
            >
              <Text style={[styles.suggestionText, isDarkMode && styles.suggestionTextDark]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.headerDark, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, isDarkMode && styles.titleDark]}>Assistant</Text>
            <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
              Powered by {selectedModel}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleNewChat}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name="add"
                size={24}
                color={isDarkMode ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
            <Host>
              <ContextMenu>
                <ContextMenu.Trigger>
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <MaterialIcons
                      name="more-vert"
                      size={24}
                      color={isDarkMode ? '#FFFFFF' : '#000000'}
                    />
                  </TouchableOpacity>
                </ContextMenu.Trigger>
                <ContextMenu.Items>
                  <Button onPress={() => setShowManualSuggestions(!showManualSuggestions)}>
                    {showManualSuggestions ? 'Hide Suggestions' : 'Show Suggestions'}
                  </Button>
                  <Button onPress={handleShareChat}>
                    Share Chat
                  </Button>
                  <Button onPress={handleExportChat}>
                    Export Chat
                  </Button>
                  <Button onPress={handleCopyToClipboard}>
                    Copy to Clipboard
                  </Button>
                  <Button onPress={handleRenameChat}>
                    Rename Chat
                  </Button>
                  <Button onPress={handleClearChat} role="destructive">
                    Clear Chat
                  </Button>
                </ContextMenu.Items>
              </ContextMenu>
            </Host>
          </View>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={[
          styles.messagesContent,
          messages.length === 0 && styles.messagesContentCentered,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {messages.length === 0 ? (
          renderWelcome()
        ) : (
          <>
            {messages.map((msg, idx) => renderMessage(msg, idx))}
            {isSending && <TypingIndicator isDarkMode={isDarkMode} />}
          </>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input */}
      <View
        style={[
          styles.inputContainer,
          isDarkMode && styles.inputContainerDark,
          {
            // When keyboard hidden: add 80px for bottom nav clearance
            // When keyboard shown: just use safe area (keyboard covers nav)
            paddingBottom: keyboardVisible
              ? Math.max(insets.bottom, 10) - 20
              : Math.max(insets.bottom, 10) + 65,
          },
        ]}
      >
        {/* Suggestion Pills */}
        {showManualSuggestions && !isSending && messages.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
            style={styles.pillsScrollView}
          >
            {[
              'What have I saved recently?',
              'Help me organize my saved items',
              'What features can you help me with?',
              '/architect Show me memory stats',
              'Search my bookmarks for AI articles',
              'Suggest items I should review',
            ].map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionPillSmall,
                  isDarkMode && styles.suggestionPillSmallDark,
                ]}
                onPress={() => handleSuggestionPress(suggestion)}
                disabled={isSending}
              >
                <Text style={[
                  styles.suggestionPillTextSmall,
                  isDarkMode && styles.suggestionPillTextSmallDark,
                ]}>
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={[styles.input, isDarkMode && styles.inputDark]}
            placeholder="Ask anything..."
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!isSending}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
});

// Message Bubble Component
interface MessageBubbleProps {
  message: AssistantMessage;
  isUser: boolean;
  isDarkMode: boolean;
  time: string;
  onCopy: (content: string) => void;
  onItemPress?: (item: Item) => void;
}

const MessageBubble = observer(({ message, isUser, isDarkMode, time, onCopy, onItemPress }: MessageBubbleProps) => {
  const scale = useSharedValue(1);
  const items = (message.metadata as any)?.items as Item[] | undefined;

  const handleLongPress = () => {
    scale.value = withSequence(
      withTiming(1.05, { duration: 100 }),
      withTiming(1.0, { duration: 100 })
    );
    onCopy(message.content);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
      ]}
    >
      <Pressable onLongPress={handleLongPress} delayLongPress={400}>
        <Animated.View
          style={[
            styles.messageBubble,
            isUser
              ? styles.userBubble
              : [styles.assistantBubble, isDarkMode && styles.assistantBubbleDark],
            animatedStyle,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser && styles.userMessageText,
              !isUser && isDarkMode && styles.assistantMessageTextDark,
            ]}
          >
            {message.content}
          </Text>
        </Animated.View>
      </Pressable>

      {/* Render item cards if available */}
      {items && items.length > 0 && (
        <View style={styles.itemCardsContainer}>
          {items.map((item: Item) => (
            <View key={item.id} style={styles.itemCardWrapper}>
              <ItemCard
                item={item}
                onPress={(item) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onItemPress?.(item);
                }}
              />
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.messageTime, isDarkMode && styles.messageTimeDark]}>
        {message.metadata?.model && !isUser && `${message.metadata.model} • `}
        {time}
      </Text>
    </View>
  );
});

// Typing Indicator Component
const TypingIndicator = observer(({ isDarkMode }: { isDarkMode: boolean }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dot: any, delay: number) => {
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  headerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderBottomColor: '#38383A',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  title: {
    fontSize: 24,
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
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messagesContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  welcomeTitleDark: {
    color: '#FFFFFF',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  welcomeSubtitleDark: {
    color: '#999999',
  },
  suggestionContainer: {
    width: '100%',
    gap: 8,
  },
  suggestionPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  suggestionPillDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#38383A',
  },
  suggestionText: {
    fontSize: 15,
    color: '#000000',
    textAlign: 'center',
  },
  suggestionTextDark: {
    color: '#FFFFFF',
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
    maxWidth: '85%',
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
  itemCardsContainer: {
    marginTop: 8,
    gap: 8,
    width: '100%',
  },
  itemCardWrapper: {
    width: '100%',
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
  pillsScrollView: {
    marginBottom: 12,
  },
  pillsContainer: {
    paddingRight: 16,
    gap: 8,
  },
  suggestionPillSmall: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  suggestionPillSmallDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
  },
  suggestionPillTextSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  suggestionPillTextSmallDark: {
    color: COLORS.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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

export default AssistantChat;
