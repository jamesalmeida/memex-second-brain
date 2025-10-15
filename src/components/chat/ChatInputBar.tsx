import React from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

interface ChatInputBarProps {
  isDarkMode: boolean;
  inputText: string;
  setInputText: (text: string) => void;
  isTyping: boolean;
  onSend: () => void;
  useBottomSheetInput?: boolean;
}

const ChatInputBar = ({ isDarkMode, inputText, setInputText, isTyping, onSend, useBottomSheetInput = false }: ChatInputBarProps) => {
  const InputComponent: any = useBottomSheetInput ? BottomSheetTextInput : TextInput;
  return (
    <View
      style={[
        styles.inputContainer,
        isDarkMode && styles.inputContainerDark,
      ]}
    >
      <InputComponent
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
          ((!inputText.trim() || isTyping) && styles.sendButtonDisabled),
        ]}
        onPress={onSend}
        disabled={!inputText.trim() || isTyping}
      >
        <MaterialIcons name="send" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default ChatInputBar;

const styles = StyleSheet.create({
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


