import React, { forwardRef, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop, BottomSheetTextInput } from '@gorhom/bottom-sheet';
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
import { chatUIStore, chatUIActions } from '../stores/chatUI';
import { aiSettingsComputed } from '../stores/aiSettings';
import { itemChatsActions, itemChatsComputed } from '../stores/itemChats';
import { chatMessagesActions, chatMessagesComputed } from '../stores/chatMessages';
import { videoTranscriptsComputed, videoTranscriptsActions } from '../stores/videoTranscripts';
import { imageDescriptionsComputed, imageDescriptionsActions } from '../stores/imageDescriptions';
import { itemTypeMetadataComputed } from '../stores/itemTypeMetadata';
import { buildItemContext, formatContextMetadata } from '../services/contextBuilder';
import { openai } from '../services/openai';
import { getYouTubeTranscript } from '../services/youtube';
import { getXVideoTranscript } from '../services/twitter';
import { serpapi } from '../services/serpapi';
import { adminPrefsStore } from '../stores/adminPrefs';
import { useToast } from '../contexts/ToastContext';
import { Item, ItemChat, ChatMessage, VideoTranscript } from '../types';
import { COLORS } from '../constants';
import uuid from 'react-native-uuid';

interface ChatSheetProps {
  onOpen?: () => void;
  onClose?: () => void;
}

const ChatSheet = observer(
  forwardRef<BottomSheet, ChatSheetProps>(({ onOpen, onClose }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const insets = useSafeAreaInsets();
    const item = chatUIStore.currentItem.get();
    const { showToast } = useToast();

    console.log('🎨 [ChatSheet] Render - item:', item?.id, item?.title);

    const [inputText, setInputText] = useState('');
    const [chat, setChat] = useState<ItemChat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [showTranscriptButton, setShowTranscriptButton] = useState(false);
    const [showDescriptionButton, setShowDescriptionButton] = useState(false);
    const [isGeneratingTranscript, setIsGeneratingTranscript] = useState(false);
    const [isGeneratingDescriptions, setIsGeneratingDescriptions] = useState(false);
    const [showModelSwitchBanner, setShowModelSwitchBanner] = useState(false);
    const [modelSwitchMessage, setModelSwitchMessage] = useState('');
    const [actualModelUsed, setActualModelUsed] = useState<string | null>(null);
    const [hasShownModelSwitchBanner, setHasShownModelSwitchBanner] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    // const snapPoints = useMemo(() => ['90%'], []);
    const snapPoints = ['90%'];
    const selectedModel = aiSettingsComputed.selectedModel();

    // Reset input state when switching items/chats
    useEffect(() => {
      setInputText('');
      setIsTyping(false);
      setHasShownModelSwitchBanner(false); // Reset banner flag for new chat
      setShowModelSwitchBanner(false);
      setActualModelUsed(null);
    }, [item?.id]);

    // Load or create chat when item changes
    useEffect(() => {
      if (item) {
        loadOrCreateChat().then(() => {
          checkForMissingContent();
        });
      }
    }, [item?.id]);

    // Watch for changes in image descriptions store to update button visibility
    useEffect(() => {
      if (item) {
        // Access the observable to establish reactivity
        const hasDescriptions = imageDescriptionsComputed.hasDescriptions(item.id);
        checkForMissingContent();
      }
    }, [item?.id, imageDescriptionsComputed.descriptions()]);

    // Watch for changes in video transcripts store to update button visibility
    useEffect(() => {
      if (item) {
        // Access the observable to establish reactivity
        const hasTranscript = videoTranscriptsComputed.hasTranscript(item.id);
        checkForMissingContent();
      }
    }, [item?.id, videoTranscriptsComputed.transcripts()]);

    const loadOrCreateChat = async () => {
      if (!item) return;

      try {
        // First check local store
        let existingChat = itemChatsComputed.getChatByItemId(item.id);

        // If not found locally, sync from Supabase and check again
        if (!existingChat) {
          await itemChatsActions.syncFromSupabase();
          existingChat = itemChatsComputed.getChatByItemId(item.id);
        }

        // If still not found, create new chat
        if (!existingChat) {
          console.log('💬 Creating new chat for item:', item.id);
          existingChat = await itemChatsActions.createChat(item.id);
        }

        if (existingChat) {
          setChat(existingChat);
          // Load messages for this chat
          const chatMessages = await chatMessagesActions.loadMessagesForChat(existingChat.id);
          setMessages(chatMessages);
          console.log('💬 Loaded chat:', existingChat.id, 'with', chatMessages.length, 'messages');
        } else {
          console.error('❌ Failed to create or load chat for item:', item.id);
        }
      } catch (error) {
        console.error('❌ Error loading/creating chat:', error);
      }
    };

    const checkForMissingContent = () => {
      if (!item) return;

      // Check if video item without transcript
      const isYouTube = item.content_type === 'youtube' || item.content_type === 'youtube_short';
      const isXVideo = item.content_type === 'x' && itemTypeMetadataComputed.getVideoUrl(item.id);
      const needsTranscript =
        (isYouTube || isXVideo) && !videoTranscriptsComputed.hasTranscript(item.id);

      // Check if item has images without descriptions
      const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);
      const needsDescriptions =
        imageUrls && imageUrls.length > 0 && !imageDescriptionsComputed.hasDescriptions(item.id);

      setShowTranscriptButton(needsTranscript);
      setShowDescriptionButton(needsDescriptions);
    };

    const handleGenerateTranscript = async () => {
      if (!item) return;

      const isYouTube = item.content_type === 'youtube' || item.content_type === 'youtube_short';
      const isXVideo = item.content_type === 'x';

      if (!isYouTube && !isXVideo) return;

      setIsGeneratingTranscript(true);
      videoTranscriptsActions.setGenerating(item.id, true);

      try {
        console.log('🎬 Generating transcript for', item.id);
        let fetchedTranscript: string;
        let language: string;
        let platform: 'youtube' | 'x';
        let segments: Array<{ startMs: number; endMs?: number; text: string }> | undefined;

        if (isYouTube && item.url) {
          // Extract video ID from URL for YouTube
          const videoIdMatch = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
          if (!videoIdMatch) {
            throw new Error('Invalid YouTube URL');
          }
          const videoId = videoIdMatch[1];

          // Check admin preference for transcript source
          const sourcePref = adminPrefsStore.youtubeTranscriptSource.get();
          console.log('[ChatSheet][Transcript] Source preference:', sourcePref);

          if (sourcePref === 'serpapi') {
            // Try SerpAPI first (prefers timestamped version)
            try {
              const serpResult = await serpapi.fetchYouTubeTranscript(item.url);
              if ((serpResult as any)?.error) {
                console.warn('[ChatSheet][Transcript] SerpAPI failed, falling back to youtubei.js:', (serpResult as any).error);
                throw new Error('SerpAPI failed');
              }

              const serpTranscript = serpResult as { transcript: string; language?: string; segments?: Array<{ startMs: number; endMs?: number; text: string }> };
              
              // Prefer timestamped format if segments are available
              if (serpTranscript.segments && serpTranscript.segments.length > 0) {
                // Format segments with timestamps: [mm:ss] text
                fetchedTranscript = serpTranscript.segments
                  .map((s) => {
                    const mm = Math.floor(s.startMs / 60000);
                    const ss = Math.floor((s.startMs % 60000) / 1000);
                    const ts = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
                    return `[${ts}] ${s.text}`;
                  })
                  .join('\n');
                segments = serpTranscript.segments; // Store segments for DB sync
              } else {
                // Fall back to plain text
                fetchedTranscript = serpTranscript.transcript;
                segments = undefined;
              }
              
              language = serpTranscript.language || 'en';
              platform = 'youtube';
            } catch (serpError) {
              // Fall back to youtubei.js
              console.log('[ChatSheet][Transcript] Falling back to youtubei.js');
              const result = await getYouTubeTranscript(videoId);
              fetchedTranscript = result.transcript;
              language = result.language;
              platform = 'youtube';
              segments = undefined;
            }
          } else {
            // Use youtubei.js
            console.log('[ChatSheet][Transcript] Using youtubei.js');
            const result = await getYouTubeTranscript(videoId);
            fetchedTranscript = result.transcript;
            language = result.language;
            platform = 'youtube';
            segments = undefined;
          }
        } else if (isXVideo) {
          // Get video URL from metadata for X posts
          const videoUrl = itemTypeMetadataComputed.getVideoUrl(item.id);
          if (!videoUrl) {
            throw new Error('No video found for this X post');
          }

          // Fetch transcript from AssemblyAI
          const result = await getXVideoTranscript(videoUrl, (status) => {
            console.log('Transcription status:', status);
          });
          fetchedTranscript = result.transcript;
          language = result.language;
          platform = 'x';
        } else {
          throw new Error('Unsupported content type for transcription');
        }

        // Create video transcript object
        const transcriptData: VideoTranscript = {
          id: uuid.v4() as string,
          item_id: item.id,
          transcript: fetchedTranscript,
          platform,
          language,
          duration: item.duration,
          segments: segments, // Store segments for toggling between timestamped/plain text
          fetched_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Save to local store and sync to Supabase
        await videoTranscriptsActions.addTranscript(transcriptData);
        console.log('🎬 Transcript saved for item:', item.id);

        // Hide the button
        setShowTranscriptButton(false);
        alert('Transcript generated successfully!');
      } catch (error) {
        console.error('Error generating transcript:', error);
        alert('Failed to generate transcript. The video may not have captions available.');
      } finally {
        setIsGeneratingTranscript(false);
        videoTranscriptsActions.setGenerating(item.id, false);
      }
    };

    const handleGenerateDescriptions = async () => {
      if (!item) return;

      const imageUrls = itemTypeMetadataComputed.getImageUrls(item.id);
      if (!imageUrls || imageUrls.length === 0) return;

      setIsGeneratingDescriptions(true);
      imageDescriptionsActions.setGenerating(item.id, true);
      try {
        console.log('🖼️  Generating descriptions for', imageUrls.length, 'images');

        for (const imageUrl of imageUrls) {
          // Generate description for each image
          const description = await openai.describeImage(imageUrl, {
            model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
          });

          if (description) {
            // Create and save the description
            const imageDescription = {
              id: `${item.id}-${imageUrl}`, // Temporary ID
              item_id: item.id,
              image_url: imageUrl,
              description,
              model: selectedModel.includes('gpt-4') ? selectedModel : 'gpt-4o-mini',
              fetched_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            await imageDescriptionsActions.addDescription(imageDescription);
          }
        }

        setShowDescriptionButton(false);
        alert(`Generated descriptions for ${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''}!`);
      } catch (error) {
        console.error('Error generating image descriptions:', error);
        alert('Failed to generate image descriptions. Please try again.');
      } finally {
        setIsGeneratingDescriptions(false);
        imageDescriptionsActions.setGenerating(item.id, false);
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
        const userMsg = await chatMessagesActions.addMessageOptimistic(
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
          // Check if model was auto-switched (only show banner the first time)
          if (completion.wasAutoSwitched && completion.autoSwitchReason && !hasShownModelSwitchBanner) {
            setShowModelSwitchBanner(true);
            setModelSwitchMessage(completion.autoSwitchReason);
            setHasShownModelSwitchBanner(true);
            // Auto-hide banner after 10 seconds
            setTimeout(() => {
              setShowModelSwitchBanner(false);
            }, 10000);
          }

          // Always update the actual model used (for header display)
          if (completion.model) {
            setActualModelUsed(completion.model);
          }

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
          const assistantMsg = await chatMessagesActions.addMessageOptimistic(
            chat.id,
            'item',
            'assistant',
            assistantMessage,
            messageMetadata
          );
          setMessages(prev => [...prev, assistantMsg]);
        } else {
          // Show error message
          const errorMsg = await chatMessagesActions.addMessageOptimistic(
            chat.id,
            'item',
            'assistant',
            'I apologize, but I could not generate a response at this time. Please try again.'
          );
          setMessages(prev => [...prev, errorMsg]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        const errorMsg = await chatMessagesActions.addMessageOptimistic(
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

    const handleClearChat = async () => {
      if (!chat) return;

      Alert.alert(
        'Clear Chat',
        'Are you sure you want to delete all messages in this chat? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: async () => {
              try {
                await chatMessagesActions.deleteMessagesByChat(chat.id);
                setMessages([]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast({
                  message: 'Chat cleared successfully',
                  type: 'success',
                  duration: 2000,
                });
              } catch (error) {
                console.error('Error clearing chat:', error);
                showToast({
                  message: 'Failed to clear chat',
                  type: 'error',
                  duration: 2000,
                });
              }
            },
          },
        ]
      );
    };

    const handleExportChat = async () => {
      if (!chat || !item || messages.length === 0) {
        showToast({
          message: 'No messages to export',
          type: 'error',
          duration: 2000,
        });
        return;
      }

      try {
        // Format the conversation
        let exportText = `Chat about: ${item.title}\n`;
        exportText += `Date: ${new Date().toLocaleDateString()}\n`;
        exportText += `Model: ${actualModelUsed || selectedModel}\n`;
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
        const file = new File(Paths.document, 'chat-export.txt');
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

    const handleShareChat = async () => {
      if (!chat || !item || messages.length === 0) {
        showToast({
          message: 'No messages to share',
          type: 'error',
          duration: 2000,
        });
        return;
      }

      try {
        // Format the conversation
        let shareText = `Chat about: ${item.title}\n`;
        shareText += `Date: ${new Date().toLocaleDateString()}\n`;
        shareText += `Model: ${actualModelUsed || selectedModel}\n`;
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

    const handleCopyToClipboard = async () => {
      if (!chat || !item || messages.length === 0) {
        showToast({
          message: 'No messages to copy',
          type: 'error',
          duration: 2000,
        });
        return;
      }

      try {
        // Format the conversation
        let copyText = `Chat about: ${item.title}\n`;
        copyText += `Date: ${new Date().toLocaleDateString()}\n`;
        copyText += `Model: ${actualModelUsed || selectedModel}\n`;
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
        showToast({
          message: 'Failed to copy message',
          type: 'error',
          duration: 2000,
        });
      }
    };

    // Get context-aware suggestion pills based on content type
    const getSuggestionPills = useCallback(() => {
      if (!item) return [];

      const basePills = [
        { label: 'TL;DR', prompt: 'Give me a concise TL;DR summary of this content.' },
        { label: 'Key Takeaways', prompt: 'What are the key takeaways from this content?' },
        { label: 'Questions I Should Ask', prompt: 'What questions should I ask to better understand this content?' },
      ];

      const videoAudioTypes = ['youtube', 'youtube_short', 'podcast', 'audio', 'video'];
      const socialMediaTypes = ['x', 'reddit', 'threads', 'instagram', 'facebook'];
      const educationalTypes = ['article', 'course', 'book', 'pdf'];
      const productTypes = ['amazon', 'product'];

      let contextPills: typeof basePills = [];

      // Video/Audio content
      if (videoAudioTypes.includes(item.content_type) ||
          (item.content_type === 'x' && itemTypeMetadataComputed.getVideoUrl(item.id))) {
        contextPills = [
          { label: 'Main Points', prompt: 'What are the main points discussed in this video/audio?' },
          { label: 'Timestamps', prompt: 'Can you organize the key topics by timestamp?' },
        ];
      }
      // Social Media content
      else if (socialMediaTypes.includes(item.content_type)) {
        contextPills = [
          { label: 'Main Arguments', prompt: 'What are the main arguments being made?' },
          { label: 'Counterarguments', prompt: 'What are potential counterarguments to these points?' },
        ];
      }
      // Educational content
      else if (educationalTypes.includes(item.content_type)) {
        contextPills = [
          { label: 'ELI5', prompt: 'Explain this like I\'m 5 years old.' },
          { label: 'Related Concepts', prompt: 'What related concepts should I explore to understand this better?' },
        ];
      }
      // Product content
      else if (productTypes.includes(item.content_type)) {
        contextPills = [
          { label: 'Pros & Cons', prompt: 'What are the pros and cons of this product?' },
          { label: 'Alternatives', prompt: 'What are some alternative products I should consider?' },
        ];
      }
      // Note content
      else if (item.content_type === 'note') {
        contextPills = [
          { label: 'Action Items', prompt: 'Extract any action items or tasks from these notes.' },
          { label: 'Organize This', prompt: 'Help me organize these notes into a clear structure.' },
        ];
      }

      return [...basePills, ...contextPills];
    }, [item]);

    const handlePillPress = async (prompt: string) => {
      if (!chat || isTyping) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInputText(prompt);
      setIsTyping(true);

      try {
        // Add user message optimistically
        const userMsg = await chatMessagesActions.addMessageOptimistic(
          chat.id,
          'item',
          'user',
          prompt
        );
        setMessages(prev => [...prev, userMsg]);

        // Build context from item
        const { contextString, metadata } = buildItemContext(item!);

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
          prompt,
          previousMessages,
          {
            model: selectedModel,
            temperature: 0.7,
            max_tokens: 1500,
          }
        );

        if (completion && completion.choices[0]) {
          // Check if model was auto-switched (only show banner the first time)
          if (completion.wasAutoSwitched && completion.autoSwitchReason && !hasShownModelSwitchBanner) {
            setShowModelSwitchBanner(true);
            setModelSwitchMessage(completion.autoSwitchReason);
            setHasShownModelSwitchBanner(true);
            // Auto-hide banner after 10 seconds
            setTimeout(() => {
              setShowModelSwitchBanner(false);
            }, 10000);
          }

          // Always update the actual model used (for header display)
          if (completion.model) {
            setActualModelUsed(completion.model);
          }

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
          const assistantMsg = await chatMessagesActions.addMessageOptimistic(
            chat.id,
            'item',
            'assistant',
            assistantMessage,
            messageMetadata
          );
          setMessages(prev => [...prev, assistantMsg]);
        } else {
          // Show error message
          const errorMsg = await chatMessagesActions.addMessageOptimistic(
            chat.id,
            'item',
            'assistant',
            'I apologize, but I could not generate a response at this time. Please try again.'
          );
          setMessages(prev => [...prev, errorMsg]);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        const errorMsg = await chatMessagesActions.addMessageOptimistic(
          chat.id,
          'item',
          'assistant',
          'An error occurred. Please check your API key and try again.'
        );
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
        setInputText('');
      }
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
        <MessageBubble
          key={message.id}
          message={message}
          isUser={isUser}
          isDarkMode={isDarkMode}
          time={time}
          modelName={modelName}
          onCopy={handleCopyMessage}
        />
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
            <View style={styles.headerContent}>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.title, isDarkMode && styles.titleDark]}>AI Chat</Text>
                <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
                  Powered by {actualModelUsed || selectedModel}
                </Text>
              </View>
              <Host>
                <ContextMenu>
                  <ContextMenu.Trigger>
                    <TouchableOpacity
                      style={styles.menuButton}
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
                    <Button onPress={handleShareChat}>
                      Share Chat
                    </Button>
                    <Button onPress={handleExportChat}>
                      Export Chat
                    </Button>
                    <Button onPress={handleCopyToClipboard}>
                      Copy to Clipboard
                    </Button>
                    <Button onPress={handleClearChat} role="destructive">
                      Clear Chat
                    </Button>
                  </ContextMenu.Items>
                </ContextMenu>
              </Host>
            </View>
          </View>

          {/* Model Switch Banner */}
          {showModelSwitchBanner && (
            <View style={[styles.modelSwitchBanner, isDarkMode && styles.modelSwitchBannerDark]}>
              <MaterialIcons name="info-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.modelSwitchText, isDarkMode && styles.modelSwitchTextDark]}>
                {modelSwitchMessage}
              </Text>
              <TouchableOpacity onPress={() => setShowModelSwitchBanner(false)}>
                <MaterialIcons name="close" size={16} color={isDarkMode ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>
          )}

          {/* Messages */}
          <BottomSheetScrollView
            ref={scrollViewRef as any}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
          >
            {renderSystemMessage()}

            {/* Generation buttons */}
            {(showTranscriptButton || showDescriptionButton) && (
              <View style={styles.generationButtonsContainer}>
                {showTranscriptButton && (
                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      isDarkMode && styles.generateButtonDark,
                      (isGeneratingTranscript || videoTranscriptsComputed.isGenerating(item?.id || '')) && styles.generateButtonDisabled,
                    ]}
                    onPress={handleGenerateTranscript}
                    disabled={isGeneratingTranscript || videoTranscriptsComputed.isGenerating(item?.id || '')}
                  >
                    {(isGeneratingTranscript || videoTranscriptsComputed.isGenerating(item?.id || '')) ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <MaterialIcons name="subtitles" size={20} color={COLORS.primary} />
                    )}
                    <Text style={[styles.generateButtonText, isDarkMode && styles.generateButtonTextDark]}>
                      {(isGeneratingTranscript || videoTranscriptsComputed.isGenerating(item?.id || '')) ? 'Processing...' : 'Generate Transcript'}
                    </Text>
                  </TouchableOpacity>
                )}

                {showDescriptionButton && (
                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      isDarkMode && styles.generateButtonDark,
                      (isGeneratingDescriptions || imageDescriptionsComputed.isGenerating(item?.id || '')) && styles.generateButtonDisabled,
                    ]}
                    onPress={handleGenerateDescriptions}
                    disabled={isGeneratingDescriptions || imageDescriptionsComputed.isGenerating(item?.id || '')}
                  >
                    {(isGeneratingDescriptions || imageDescriptionsComputed.isGenerating(item?.id || '')) ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <MaterialIcons name="image" size={20} color={COLORS.primary} />
                    )}
                    <Text style={[styles.generateButtonText, isDarkMode && styles.generateButtonTextDark]}>
                      {(isGeneratingDescriptions || imageDescriptionsComputed.isGenerating(item?.id || '')) ? 'Processing Images...' : 'Generate Image Descriptions'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

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
            {/* Suggestion Pills */}
            {messages.length === 0 && !isTyping && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsContainer}
                style={styles.pillsScrollView}
              >
                {getSuggestionPills().map((pill, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.suggestionPill,
                      isDarkMode && styles.suggestionPillDark,
                    ]}
                    onPress={() => handlePillPress(pill.prompt)}
                    disabled={isTyping}
                  >
                    <Text style={[
                      styles.suggestionPillText,
                      isDarkMode && styles.suggestionPillTextDark,
                    ]}>
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.inputRow}>
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
                  ((!inputText.trim() || isTyping || !chat) && styles.sendButtonDisabled),
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isTyping || !chat}
              >
                {isTyping ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="send" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BottomSheet>
    );
  })
);

// Message Bubble Component with Long Press Animation
interface MessageBubbleProps {
  message: ChatMessage;
  isUser: boolean;
  isDarkMode: boolean;
  time: string;
  modelName?: string;
  onCopy: (content: string) => void;
}

const MessageBubble = observer(({ message, isUser, isDarkMode, time, modelName, onCopy }: MessageBubbleProps) => {
  const scale = useSharedValue(1);

  const handleLongPress = () => {
    // Animate scale: grow to 1.05, then back to 1.0
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
      <Text style={[styles.messageTime, isDarkMode && styles.messageTimeDark]}>
        {modelName && !isUser && `${modelName} • `}
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
  },
  menuButton: {
    padding: 8,
    marginLeft: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  modelSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  modelSwitchBannerDark: {
    backgroundColor: '#1A237E',
    borderBottomColor: '#38383A',
  },
  modelSwitchText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
  modelSwitchTextDark: {
    color: '#90CAF9',
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
  suggestionPill: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5E7',
  },
  suggestionPillDark: {
    backgroundColor: '#2C2C2E',
    borderColor: '#38383A',
  },
  suggestionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  suggestionPillTextDark: {
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
  generationButtonsContainer: {
    paddingVertical: 12,
    gap: 10,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
  },
  generateButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },
  generateButtonTextDark: {
    color: COLORS.primary,
  },
});

export default ChatSheet;
