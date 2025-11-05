import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { observer } from '@legendapp/state/react';
import { close, openHostApp, type InitialProps } from 'expo-share-extension';
import uuid from 'react-native-uuid';
import { themeStore, themeActions } from '../stores/theme';
import { spacesStore } from '../stores/spaces';
import { itemsActions } from '../stores/items';
import { authStore, authActions } from '../stores/auth';
import { auth } from '../services/supabase';
import { extractURLMetadata } from '../services/urlMetadata';
import { Item, ContentType, User } from '../types';

const { height: screenHeight } = Dimensions.get('window');

const ShareExtension = (props: InitialProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [metadata, setMetadata] = useState<{
    title: string;
    description?: string;
    image?: string;
    contentType: ContentType;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Safely access stores with fallbacks
  const isDarkMode = themeStore?.isDarkMode?.get() ?? false;
  const spaces = (spacesStore?.spaces?.get() ?? []).filter(s => !s.is_deleted && !s.is_archived);
  const user = authStore?.user?.get() ?? null;

  // Initialize stores on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[ShareExtension] Initializing...');
        console.log('[ShareExtension] Received props:', props);

        // Load theme preference
        await themeActions.loadThemePreference();

        // Initialize auth state (replicate useAuth logic)
        authActions.setLoading(true);
        try {
          const { data: { session }, error } = await auth.getSession();

          if (error) {
            console.error('[ShareExtension] Auth session error:', error);
          }

          if (session?.user) {
            const user: User = {
              id: session.user.id,
              email: session.user.email || '',
              user_metadata: session.user.user_metadata,
            };
            authActions.setUser(user);
            authActions.setSession(session);
            console.log('[ShareExtension] User authenticated:', user.email);
          } else {
            console.log('[ShareExtension] No active session');
          }
        } catch (authError) {
          console.error('[ShareExtension] Auth initialization error:', authError);
        } finally {
          authActions.setLoading(false);
        }

        // Spaces auto-load on import, just give them a moment
        await new Promise(resolve => setTimeout(resolve, 100));

        // Extract metadata from shared content
        if (props.url) {
          console.log('[ShareExtension] Extracting metadata for URL:', props.url);
          try {
            const urlMetadata = await extractURLMetadata(props.url);
            setMetadata({
              title: urlMetadata.title || props.url,
              description: urlMetadata.description,
              image: urlMetadata.image,
              contentType: urlMetadata.contentType as ContentType,
            });
          } catch (err) {
            console.error('[ShareExtension] Error extracting metadata:', err);
            setMetadata({
              title: props.url,
              contentType: 'bookmark',
            });
          }
        } else if (props.text) {
          // For shared text, create a note
          setMetadata({
            title: props.text.length > 100 ? props.text.substring(0, 100) + '...' : props.text,
            description: props.text,
            contentType: 'note',
          });
        } else if (props.images && props.images.length > 0) {
          // For shared images
          setMetadata({
            title: `Shared Image${props.images.length > 1 ? 's' : ''}`,
            image: props.images[0],
            contentType: 'image',
          });
        } else if (props.videos && props.videos.length > 0) {
          // For shared videos
          setMetadata({
            title: 'Shared Video',
            contentType: 'video',
          });
        } else {
          setError('No content to share');
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[ShareExtension] Initialization error:', err);
        setError('Failed to initialize share extension');
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const handleSave = async () => {
    if (!metadata || !user) {
      setError('Unable to save. Please make sure you are signed in.');
      return;
    }

    setIsSaving(true);

    try {
      // Create new item
      const newItem: Item = {
        id: uuid.v4() as string,
        user_id: user.id,
        title: metadata.title,
        url: props.url,
        content_type: metadata.contentType,
        desc: metadata.description,
        thumbnail_url: metadata.image,
        content: props.text,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        space_id: selectedSpaceId,
        is_archived: false,
        is_deleted: false,
      };

      // Add item with sync
      await itemsActions.addItemWithSync(newItem);

      console.log('[ShareExtension] Item saved successfully:', newItem.id);

      // Close the share extension
      close();
    } catch (err) {
      console.error('[ShareExtension] Error saving item:', err);
      setError('Failed to save item. Please try again.');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    close();
  };

  const handleOpenHostApp = () => {
    // Just open the main app without a specific path
    // The useAuth hook will handle routing to the correct screen based on auth state
    openHostApp('');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDarkMode ? '#fff' : '#007AFF'} />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>
            Please sign in to the Memex app first.
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleOpenHostApp}
          >
            <Text style={styles.buttonText}>Open Memex</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
            Save to Memex
          </Text>
        </View>

        {/* Content Preview */}
        <View style={[styles.previewContainer, isDarkMode && styles.previewContainerDark]}>
          {metadata?.image && (
            <Image
              source={{ uri: metadata.image }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          )}
          <View style={styles.previewText}>
            <Text style={[styles.previewTitle, isDarkMode && styles.previewTitleDark]} numberOfLines={3}>
              {metadata?.title || 'Untitled'}
            </Text>
            {metadata?.description && (
              <Text style={[styles.previewDescription, isDarkMode && styles.previewDescriptionDark]} numberOfLines={2}>
                {metadata.description}
              </Text>
            )}
            {props.url && (
              <Text style={[styles.previewUrl, isDarkMode && styles.previewUrlDark]} numberOfLines={1}>
                {props.url}
              </Text>
            )}
          </View>
        </View>

        {/* Space Selector */}
        <View style={styles.spaceSelectorContainer}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>
            SPACE
          </Text>
          <TouchableOpacity
            style={[styles.selector, isDarkMode && styles.selectorDark]}
            onPress={() => setShowSpaceSelector(!showSpaceSelector)}
            activeOpacity={0.7}
          >
            {selectedSpace ? (
              <View style={styles.selectedSpace}>
                <View style={[styles.spaceDot, { backgroundColor: selectedSpace.color }]} />
                <Text style={[styles.spaceText, isDarkMode && styles.spaceTextDark]}>
                  {selectedSpace.name}
                </Text>
              </View>
            ) : (
              <Text style={[styles.noSpace, isDarkMode && styles.noSpaceDark]}>
                Everything (No Space)
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
                onPress={() => {
                  setSelectedSpaceId(null);
                  setShowSpaceSelector(false);
                }}
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
                    Everything (No Space)
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Space Options */}
              {spaces.map((space) => (
                <TouchableOpacity
                  key={space.id}
                  style={styles.spaceOption}
                  onPress={() => {
                    setSelectedSpaceId(space.id);
                    setShowSpaceSelector(false);
                  }}
                >
                  <View style={styles.spaceOptionContent}>
                    <View style={[
                      styles.radioButton,
                      selectedSpaceId === space.id && styles.radioButtonSelected
                    ]}>
                      {selectedSpaceId === space.id && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={[styles.spaceDot, { backgroundColor: space.color }]} />
                    <Text style={[styles.spaceOptionText, isDarkMode && styles.spaceOptionTextDark]}>
                      {space.name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, isDarkMode && styles.footerDark]}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={isSaving}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
  },
  loadingTextDark: {
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorTextDark: {
    color: '#FF453A',
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  headerTitleDark: {
    color: '#fff',
  },
  previewContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  previewContainerDark: {
    backgroundColor: '#1C1C1E',
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  previewText: {
    gap: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  previewTitleDark: {
    color: '#fff',
  },
  previewDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  previewDescriptionDark: {
    color: '#999',
  },
  previewUrl: {
    fontSize: 12,
    color: '#007AFF',
  },
  previewUrlDark: {
    color: '#0A84FF',
  },
  spaceSelectorContainer: {
    marginBottom: 20,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
  },
  selectorDark: {
    backgroundColor: '#1C1C1E',
  },
  selectedSpace: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  spaceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  spaceText: {
    fontSize: 16,
    color: '#000',
  },
  spaceTextDark: {
    color: '#fff',
  },
  noSpace: {
    fontSize: 16,
    color: '#666',
  },
  noSpaceDark: {
    color: '#999',
  },
  chevron: {
    fontSize: 12,
    color: '#666',
  },
  spaceOptions: {
    marginTop: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    overflow: 'hidden',
  },
  spaceOptionsDark: {
    backgroundColor: '#1C1C1E',
  },
  spaceOption: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  spaceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  spaceOptionText: {
    fontSize: 16,
    color: '#000',
  },
  spaceOptionTextDark: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  footerDark: {
    borderTopColor: '#2C2C2E',
    backgroundColor: '#000',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default observer(ShareExtension);
