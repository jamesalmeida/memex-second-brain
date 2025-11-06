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
import { createClient } from '@supabase/supabase-js';
import { themeStore, themeActions } from '../stores/theme';
import { spacesStore } from '../stores/spaces';
import { authStore, authActions } from '../stores/auth';
import { auth } from '../services/supabase';
import { SUPABASE } from '../constants';
import { extractURLMetadata } from '../services/urlMetadata';
import { addItemToSharedQueue } from '../services/sharedItemQueue';
import { getSharedAuth } from '../services/sharedAuth';
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
  const [hasKeychainAuth, setHasKeychainAuth] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

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

        // Check for Keychain auth
        const keychainAuth = await getSharedAuth();
        setHasKeychainAuth(!!keychainAuth);
        console.log('[ShareExtension] Keychain auth available:', !!keychainAuth);

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

  // Auto-save effect: triggers when metadata is ready and user is authenticated
  useEffect(() => {
    if (!isLoading && metadata && hasKeychainAuth && !autoSaveTimer && !showSuccess) {
      console.log('[ShareExtension] Starting auto-save timer (2s)...');
      const timer = setTimeout(async () => {
        console.log('[ShareExtension] Auto-save triggered');
        await handleSave();
      }, 2000); // 2 second delay to show preview
      setAutoSaveTimer(timer);
    }
  }, [isLoading, metadata, hasKeychainAuth, autoSaveTimer, showSuccess]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

  const handleSave = async () => {
    if (!metadata) {
      setError('Unable to save. No content to save.');
      return;
    }

    setIsSaving(true);

    try {
      // Create new item
      const newItem: Item = {
        id: uuid.v4() as string,
        user_id: 'pending', // Will be updated below
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

      // Try to get shared auth credentials
      const authData = await getSharedAuth();

      if (authData) {
        // We have auth! Sync directly to Supabase
        console.log('[ShareExtension] Auth found, syncing directly to Supabase...');

        try {
          // Create authenticated Supabase client
          const supabase = createClient(SUPABASE.URL, SUPABASE.ANON_KEY, {
            auth: {
              persistSession: false, // Don't persist in extension
              autoRefreshToken: false, // Don't auto-refresh in extension
            },
          });

          // Set the session from shared storage
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: authData.access_token,
            refresh_token: authData.refresh_token,
          });

          if (sessionError) {
            console.error('[ShareExtension] Session error:', sessionError);
            throw sessionError;
          }

          // Update user_id with actual user ID
          newItem.user_id = authData.user_id;

          // Insert directly to Supabase
          const { error: insertError } = await supabase
            .from('items')
            .insert(newItem);

          if (insertError) {
            console.error('[ShareExtension] Insert error:', insertError);
            throw insertError;
          }

          console.log('[ShareExtension] ✅ Item synced directly to Supabase:', newItem.id);

          // Show success banner
          setIsSaving(false);
          setShowSuccess(true);

          // Auto-dismiss after 1 second
          setTimeout(() => {
            close();
          }, 1000);
          return;
        } catch (supabaseError) {
          console.error('[ShareExtension] Supabase sync failed, falling back to queue:', supabaseError);
          // Fall through to queue mechanism
        }
      } else {
        console.log('[ShareExtension] No auth found, using queue mechanism');
      }

      // Fallback: Add to queue if auth is missing or sync failed
      newItem.user_id = authData?.user_id || 'pending';
      await addItemToSharedQueue(newItem);
      console.log('[ShareExtension] Item added to queue:', newItem.id);

      // Show success banner
      setIsSaving(false);
      setShowSuccess(true);

      // Auto-dismiss after 1 second
      setTimeout(() => {
        close();
      }, 1000);
    } catch (err) {
      console.error('[ShareExtension] Error saving item:', err);
      setError('Failed to save item. Please try again.');
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Clear auto-save timer if active
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      setAutoSaveTimer(null);
    }
    close();
  };

  const handleOpenHostApp = () => {
    // Open the main app
    // Use the scheme without path to go to root
    try {
      openHostApp('/');
    } catch (error) {
      console.error('[ShareExtension] Error opening host app:', error);
    }
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

        {/* Success Banner */}
        {showSuccess && (
          <View style={[styles.successBanner, isDarkMode && styles.successBannerDark]}>
            <Text style={styles.successText}>
              ✓ Saved successfully!
            </Text>
          </View>
        )}

        {/* Not Signed In Warning - Only show if no Keychain auth */}
        {!hasKeychainAuth && (
          <View style={[styles.warningBanner, isDarkMode && styles.warningBannerDark]}>
            <Text style={[styles.warningText, isDarkMode && styles.warningTextDark]}>
              Please sign in to save items
            </Text>
          </View>
        )}

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
            onPress={() => {
              // Pause auto-save when user opens space selector
              if (autoSaveTimer && !showSpaceSelector) {
                console.log('[ShareExtension] Pausing auto-save - user opening space selector');
                clearTimeout(autoSaveTimer);
                setAutoSaveTimer(null);
              }
              setShowSpaceSelector(!showSpaceSelector);
            }}
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
      {!hasKeychainAuth ? (
        // Not authenticated - Show "Open Memex to Sign In" button
        <View style={[styles.footer, isDarkMode && styles.footerDark]}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleOpenHostApp}
          >
            <Text style={styles.buttonText}>Open Memex to Sign In</Text>
          </TouchableOpacity>
        </View>
      ) : !showSuccess ? (
        // Authenticated - Show Cancel button (and Save if space selector is open or manual trigger needed)
        <View style={[styles.footer, isDarkMode && styles.footerDark]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          {(showSpaceSelector || !autoSaveTimer) && (
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
          )}
        </View>
      ) : null}
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
  warningBanner: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningBannerDark: {
    backgroundColor: '#4A4220',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  warningTextDark: {
    color: '#FFEB3B',
  },
  successBanner: {
    backgroundColor: '#D4EDDA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successBannerDark: {
    backgroundColor: '#1B4332',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#155724',
    textAlign: 'center',
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
