import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { observer } from '@legendapp/state/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { themeStore } from '../../src/stores/theme';
import { spacesComputed } from '../../src/stores/spaces';
import { spaceChatsActions, spaceChatsComputed } from '../../src/stores/spaceChats';
import { chatMessagesActions, chatMessagesComputed } from '../../src/stores/chatMessages';
import { aiSettingsComputed } from '../../src/stores/aiSettings';
import { buildSpaceContext, formatContextMetadata } from '../../src/services/contextBuilder';
import { openai } from '../../src/services/openai';
import ChatMessagesList from '../../src/components/chat/ChatMessagesList';
import ChatInputBar from '../../src/components/chat/ChatInputBar';

const SpaceChatScreen = observer(() => {
  const isDarkMode = themeStore.isDarkMode.get();
  const insets = useSafeAreaInsets();

  const selectedSpace = spacesComputed.selectedSpace();
  const selectedModel = aiSettingsComputed.selectedModel();

  const scrollRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  // Create or load chat for selected space
  useEffect(() => {
    const ensureChat = async () => {
      if (!selectedSpace) {
        setChatId(null);
        return;
      }

      let chat = spaceChatsComputed.getChatBySpaceId(selectedSpace.id);
      if (!chat) {
        await spaceChatsActions.syncFromSupabase();
        chat = spaceChatsComputed.getChatBySpaceId(selectedSpace.id);
      }
      if (!chat) {
        chat = await spaceChatsActions.createChat(selectedSpace.id);
      }
      if (chat) {
        setChatId(chat.id);
        await chatMessagesActions.loadMessagesForChat(chat.id);
      }
    };
    ensureChat();
    setInputText('');
    setIsTyping(false);
  }, [selectedSpace?.id]);

  const messages = useMemo(() => (chatId ? chatMessagesComputed.getMessagesByChatId(chatId) : []), [chatId, chatMessagesComputed.messages()]);

  const systemTitle = selectedSpace ? `💬 Chatting about space: ${selectedSpace.name}` : undefined;
  const systemSubtitle = selectedSpace ? (() => {
    const { metadata } = buildSpaceContext(selectedSpace);
    return `Context: ${formatContextMetadata(metadata)}`;
  })() : undefined;

  const handleSend = async () => {
    if (!inputText.trim() || !selectedSpace || !chatId || isTyping) return;

    const userMessage = inputText.trim();
    setInputText('');
    setIsTyping(true);

    try {
      // Add user message optimistically
      await chatMessagesActions.addMessageOptimistic(
        chatId,
        'space',
        'user',
        userMessage
      );

      // Build space context and get previous messages
      const { contextString } = buildSpaceContext(selectedSpace);
      const previousMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Call OpenAI
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

        await chatMessagesActions.addMessageOptimistic(
          chatId,
          'space',
          'assistant',
          assistantMessage,
          messageMetadata
        );
      } else {
        await chatMessagesActions.addMessageOptimistic(
          chatId,
          'space',
          'assistant',
          'I could not generate a response right now. Please try again.'
        );
      }
    } catch (error) {
      console.error('Error sending space chat message:', error);
      await chatMessagesActions.addMessageOptimistic(
        chatId!,
        'space',
        'assistant',
        'An error occurred. Please try again.'
      );
    } finally {
      setIsTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  // Everything Search placeholder
  if (!selectedSpace) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}> 
        <View style={[styles.placeholder, { paddingTop: insets.top + 20 }]}> 
          <Text style={[styles.placeholderTitle, isDarkMode && styles.placeholderTitleDark]}>Search Everything</Text>
          <Text style={[styles.placeholderSubtitle, isDarkMode && styles.placeholderSubtitleDark]}>This is a temporary placeholder. Select a space in the top tabs to start a space chat.</Text>
        </View>
      </View>
    );
  }

  const NAV_OFFSET = 80; // Bottom navigation height allowance
  const INPUT_PAD = 40; // Extra space so list doesn't hide behind input

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}> 
      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: INPUT_PAD + NAV_OFFSET }}> 
        <ChatMessagesList
          isDarkMode={isDarkMode}
          messages={messages}
          isTyping={isTyping}
          scrollRef={scrollRef}
          systemTitle={systemTitle}
          systemSubtitle={systemSubtitle}
        />
      </View>
      <View style={{ paddingBottom: insets.bottom, marginBottom: NAV_OFFSET }}>
        <ChatInputBar
          isDarkMode={isDarkMode}
          inputText={inputText}
          setInputText={setInputText}
          isTyping={isTyping}
          onSend={handleSend}
        />
      </View>
    </View>
  );
});

export default SpaceChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  placeholderTitleDark: {
    color: '#FFFFFF',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
  },
  placeholderSubtitleDark: {
    color: '#999999',
  },
});


