import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { artworkUrl } from '../hooks/useLibrary';
import { useServer } from '../hooks/useServer';
import { usePlayerStore } from '../store/playerStore';

export function NowPlayingBar() {
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
    likedTrackIds,
    toggleLike,
  } = usePlayerStore();

  if (!currentTrack) return null;

  const artwork = artworkUrl(baseUrl, currentTrack.id);
  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const isLiked = !!likedTrackIds[currentTrack.id];

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.9}
      onPress={() => router.push('/now-playing')}
    >
      {/* Thin progress line at top */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { flex: Math.max(0.001, progress) }]} />
        <View style={{ flex: Math.max(0.001, 1 - progress) }} />
      </View>

      <View style={styles.inner}>
        {/* Artwork + info */}
        <View style={styles.trackInfo}>
          <Image
            source={artwork ?? undefined}
            style={styles.artwork}
            contentFit="cover"
            transition={150}
          />
          <View style={styles.textBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => toggleLike(currentTrack.id)}
            hitSlop={12}
            style={styles.heartBtn}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? Colors.accent : Colors.textDim}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => playPrevious()} hitSlop={12} style={styles.ctrlBtn}>
            <Ionicons name="play-skip-back" size={22} color={Colors.text} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => togglePlayPause()} hitSlop={8} style={styles.playBtn}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={Colors.background}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => playNext()} hitSlop={12} style={styles.ctrlBtn}>
            <Ionicons name="play-skip-forward" size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.surface,
  },
  progressTrack: {
    height: 2,
    backgroundColor: Colors.border,
    flexDirection: 'row',
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.accent,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minWidth: 0,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  artist: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  heartBtn: {
    padding: 4,
  },
  ctrlBtn: {
    padding: 4,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
