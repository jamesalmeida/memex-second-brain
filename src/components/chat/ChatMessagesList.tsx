import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ChatMessage } from '../../types';
import { COLORS } from '../../constants';
import TypingIndicator from './TypingIndicator';

interface ChatMessagesListProps {
  isDarkMode: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  scrollRef?: React.RefObject<ScrollView>;
  systemTitle?: string;
  systemSubtitle?: string;
}

const ChatMessagesList = ({ isDarkMode, messages, isTyping, scrollRef, systemTitle, systemSubtitle }: ChatMessagesListProps) => {
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const modelName = message.metadata?.model;
    const time = new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

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
            isUser ? styles.userBubble : [styles.assistantBubble, isDarkMode && styles.assistantBubbleDark],
          ]}
        >
          <Text style={[
            styles.messageText,
            isUser && styles.userMessageText,
            !isUser && isDarkMode && styles.assistantMessageTextDark,
          ]}>{message.content}</Text>
        </View>
        <Text style={[styles.messageTime, isDarkMode && styles.messageTimeDark]}>
          {modelName && !isUser && `${modelName} • `}
          {time}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.messagesContainer}
      showsVerticalScrollIndicator={false}
    >
      {(systemTitle || systemSubtitle) && (
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessagePill, isDarkMode && styles.systemMessagePillDark]}>
            {systemTitle ? (
              <Text style={[styles.systemMessageTitle, isDarkMode && styles.systemMessageTitleDark]}>
                {systemTitle}
              </Text>
            ) : null}
            {systemSubtitle ? (
              <Text style={[styles.systemMessageSubtitle, isDarkMode && styles.systemMessageSubtitleDark]}>
                {systemSubtitle}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {messages.map(m => renderMessage(m))}

      {isTyping && <TypingIndicator isDarkMode={isDarkMode} />}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

export default ChatMessagesList;

const styles = StyleSheet.create({
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
});


