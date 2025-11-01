import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { Host, Slider } from '@expo/ui/swift-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_PADDING = 20;
const CONTENT_WIDTH = SCREEN_WIDTH - (CONTENT_PADDING * 2);

interface AudioPlayerProps {
  audioUrl: string;
  isDarkMode: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, isDarkMode }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // Set audio mode for playback
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });

    return () => {
      isMounted.current = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    loadAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [audioUrl]);

  const loadAudio = async () => {
    try {
      setIsLoading(true);

      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }

      console.log('🎙️ [AudioPlayer] Loading audio from:', audioUrl);

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );

      if (isMounted.current) {
        setSound(newSound);
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (!isMounted.current) return;

    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsLoading(false);

      if (status.didJustFinish) {
        // Reset to beginning when finished
        setPosition(0);
        setIsPlaying(false);
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  };

  const handleSeek = async (value: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(value);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const skip = async (seconds: number) => {
    if (!sound) return;

    try {
      const newPosition = Math.max(0, Math.min(duration, position + (seconds * 1000)));
      await sound.setPositionAsync(newPosition);
    } catch (error) {
      console.error('Error skipping:', error);
    }
  };

  const cyclePlaybackRate = async () => {
    if (!sound) return;

    const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];

    try {
      await sound.setRateAsync(nextRate, true);
      setPlaybackRate(nextRate);
    } catch (error) {
      console.error('Error changing playback rate:', error);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Playback controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => skip(-15)}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="replay-10"
            size={32}
            color={isDarkMode ? '#FFF' : '#000'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={togglePlayPause}
          style={[styles.playButton, isDarkMode && styles.playButtonDark]}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <MaterialIcons name="hourglass-empty" size={40} color={isDarkMode ? '#000' : '#FFF'} />
          ) : isPlaying ? (
            <MaterialIcons name="pause" size={40} color={isDarkMode ? '#000' : '#FFF'} />
          ) : (
            <MaterialIcons name="play-arrow" size={40} color={isDarkMode ? '#000' : '#FFF'} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => skip(30)}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="forward-30"
            size={32}
            color={isDarkMode ? '#FFF' : '#000'}
          />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Text style={[styles.timeText, isDarkMode && styles.timeTextDark]}>
          {formatTime(position)}
        </Text>
        <Host style={styles.slider}>
          <Slider
            value={duration > 0 ? position / duration : 0}
            onValueChange={(value) => handleSeek(value * duration)}
          />
        </Host>
        <Text style={[styles.timeText, isDarkMode && styles.timeTextDark]}>
          {formatTime(duration)}
        </Text>
      </View>

      {/* Playback rate button */}
      <View style={styles.rateContainer}>
        <TouchableOpacity
          onPress={cyclePlaybackRate}
          style={[styles.rateButton, isDarkMode && styles.rateButtonDark]}
          activeOpacity={0.7}
        >
          <Text style={[styles.rateText, isDarkMode && styles.rateTextDark]}>
            {playbackRate}x
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AudioPlayer;

const styles = StyleSheet.create({
  container: {
    width: CONTENT_WIDTH,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  containerDark: {
    backgroundColor: '#2C2C2E',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
  },
  skipButton: {
    padding: 8,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  playButtonDark: {
    backgroundColor: '#5AC8FA',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontVariant: ['tabular-nums'],
    minWidth: 45,
    textAlign: 'center',
  },
  timeTextDark: {
    color: '#999',
  },
  rateContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  rateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 16,
  },
  rateButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  rateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  rateTextDark: {
    color: '#FFF',
  },
});
