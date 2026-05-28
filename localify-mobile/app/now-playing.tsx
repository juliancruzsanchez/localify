import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { artworkUrl } from '../hooks/useLibrary';
import { useServer } from '../hooks/useServer';
import { usePlayerStore } from '../store/playerStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ARTWORK_SIZE = SCREEN_WIDTH - Spacing.xl * 2;

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function NowPlayingModal() {
  const router = useRouter();
  const { baseUrl } = useServer();
  const {
    currentTrack,
    isPlaying,
    positionMs,
    durationMs,
    togglePlayPause,
    playNext,
    playPrevious,
  } = usePlayerStore();

  if (!currentTrack) {
    router.back();
    return null;
  }

  const artwork = artworkUrl(baseUrl, currentTrack.id);
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <View style={styles.container}>
      {/* Dismiss handle */}
      <View style={styles.handle} />

      {/* Artwork */}
      <Image
        source={artwork ?? undefined}
        style={styles.artwork}
        contentFit="cover"
        transition={200}
      />

      {/* Track info */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <TouchableOpacity style={styles.heartBtn}>
          <Text style={styles.heartIcon}>♡</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Controls — matches desktop: previous, play/pause, next */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => playPrevious()} hitSlop={16} style={styles.ctrlBtn}>
          <Text style={styles.ctrlIcon}>⏮</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => togglePlayPause()}
          activeOpacity={0.8}
        >
          <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => playNext()} hitSlop={16} style={styles.ctrlBtn}>
          <Text style={styles.ctrlIcon}>⏭</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textDim,
    marginBottom: Spacing.xl,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  infoText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  artist: {
    color: Colors.textMuted,
    fontSize: FontSize.base,
  },
  heartBtn: {
    padding: Spacing.sm,
  },
  heartIcon: {
    color: Colors.textMuted,
    fontSize: 24,
  },
  progressContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    flexDirection: 'row',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.text,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  timeText: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    width: '100%',
  },
  ctrlBtn: {
    padding: Spacing.sm,
  },
  ctrlIcon: {
    color: Colors.text,
    fontSize: 28,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    color: Colors.background,
    fontSize: FontSize.xxl,
    marginLeft: 4,
  },
});
