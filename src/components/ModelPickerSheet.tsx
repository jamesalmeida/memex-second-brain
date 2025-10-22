import React, { forwardRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { MaterialIcons } from '@expo/vector-icons';
import { observer } from '@legendapp/state/react';
import { themeStore } from '../stores/theme';
import { aiSettingsStore, aiSettingsActions, OpenAIModel } from '../stores/aiSettings';
import { COLORS } from '../constants';

interface ModelPickerSheetProps {
  onModelSelected?: (modelId: string) => void;
  modelType?: 'chat' | 'metadata'; // Which model to update
}

const ModelPickerSheet = observer(
  forwardRef<BottomSheet, ModelPickerSheetProps>(({ onModelSelected, modelType = 'chat' }, ref) => {
    const isDarkMode = themeStore.isDarkMode.get();
    const selectedChatModel = aiSettingsStore.selectedModel.get();
    const selectedMetadataModel = aiSettingsStore.metadataModel.get();
    const availableModels = aiSettingsStore.availableModels.get();

    // Use appropriate selected model based on type
    const selectedModel = modelType === 'metadata' ? selectedMetadataModel : selectedChatModel;

    const snapPoints = useMemo(() => ['70%'], []);

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

    const handleModelSelect = async (modelId: string) => {
      // Update appropriate model based on type
      if (modelType === 'metadata') {
        await aiSettingsActions.setMetadataModel(modelId);
      } else {
        await aiSettingsActions.setSelectedModel(modelId);
      }
      onModelSelected?.(modelId);
      (ref as any)?.current?.close();
    };

    const getModelDisplayName = (model: OpenAIModel): string => {
      return model.id;
    };

    const getModelDescription = (model: OpenAIModel): string => {
      const id = model.id.toLowerCase();

      if (id.includes('gpt-4o')) {
        if (id.includes('mini')) {
          return 'Fast, affordable, intelligent';
        }
        return 'High intelligence multimodal model';
      }
      if (id.includes('gpt-4-turbo')) {
        return 'Previous generation high intelligence';
      }
      if (id.includes('gpt-4')) {
        return 'Most capable model';
      }
      if (id.includes('gpt-3.5-turbo')) {
        return 'Fast and efficient';
      }

      return 'OpenAI language model';
    };

    const getModelBadge = (model: OpenAIModel): string | null => {
      const id = model.id.toLowerCase();

      if (id === 'gpt-4o-mini') {
        return '💡 Recommended';
      }
      if (id === 'gpt-4o') {
        return '⚡ Latest';
      }
      if (id.includes('preview') || id.includes('beta')) {
        return '🧪 Preview';
      }

      return null;
    };

    // Group models by family
    const groupedModels = useMemo(() => {
      const groups: { [key: string]: OpenAIModel[] } = {
        'GPT-4o': [],
        'GPT-4 Turbo': [],
        'GPT-4': [],
        'GPT-3.5': [],
        'Other': [],
      };

      availableModels.forEach(model => {
        const id = model.id.toLowerCase();
        if (id.includes('gpt-4o')) {
          groups['GPT-4o'].push(model);
        } else if (id.includes('gpt-4-turbo')) {
          groups['GPT-4 Turbo'].push(model);
        } else if (id.includes('gpt-4')) {
          groups['GPT-4'].push(model);
        } else if (id.includes('gpt-3.5')) {
          groups['GPT-3.5'].push(model);
        } else {
          groups['Other'].push(model);
        }
      });

      // Remove empty groups
      return Object.entries(groups).filter(([_, models]) => models.length > 0);
    }, [availableModels]);

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={[
          styles.sheetBackground,
          isDarkMode && styles.sheetBackgroundDark,
        ]}
        handleIndicatorStyle={[
          styles.handleIndicator,
          isDarkMode && styles.handleIndicatorDark,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            {modelType === 'metadata' ? 'Select Metadata Model' : 'Select Chat Model'}
          </Text>
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
            {modelType === 'metadata'
              ? 'Used for title/description extraction'
              : `${availableModels.length} models available`}
          </Text>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {groupedModels.map(([groupName, models]) => (
            <View key={groupName} style={styles.group}>
              <Text style={[styles.groupTitle, isDarkMode && styles.groupTitleDark]}>
                {groupName}
              </Text>

              {models.map(model => {
                const isSelected = model.id === selectedModel;
                const badge = getModelBadge(model);

                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelRow,
                      isDarkMode && styles.modelRowDark,
                      isSelected && styles.modelRowSelected,
                    ]}
                    onPress={() => handleModelSelect(model.id)}
                  >
                    <View style={styles.modelContent}>
                      <View style={styles.modelHeader}>
                        <Text
                          style={[
                            styles.modelName,
                            isDarkMode && styles.modelNameDark,
                            isSelected && styles.modelNameSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {getModelDisplayName(model)}
                        </Text>
                        {badge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.modelDescription,
                          isDarkMode && styles.modelDescriptionDark,
                        ]}
                        numberOfLines={1}
                      >
                        {getModelDescription(model)}
                      </Text>
                    </View>

                    {isSelected && (
                      <MaterialIcons
                        name="check-circle"
                        size={24}
                        color={COLORS.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={{ height: 40 }} />
        </BottomSheetScrollView>
      </BottomSheet>
    );
  })
);

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  sheetBackgroundDark: {
    backgroundColor: '#1C1C1E',
  },
  handleIndicator: {
    backgroundColor: '#CCCCCC',
    width: 40,
  },
  handleIndicatorDark: {
    backgroundColor: '#666666',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  group: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupTitleDark: {
    color: '#999999',
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    marginBottom: 8,
  },
  modelRowDark: {
    backgroundColor: '#2C2C2E',
  },
  modelRowSelected: {
    backgroundColor: '#E8F4FF',
  },
  modelContent: {
    flex: 1,
    marginRight: 12,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  modelNameDark: {
    color: '#FFFFFF',
  },
  modelNameSelected: {
    color: COLORS.primary,
  },
  modelDescription: {
    fontSize: 13,
    color: '#666666',
  },
  modelDescriptionDark: {
    color: '#999999',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ModelPickerSheet;
