import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import type { TrackSummary } from '../hooks/useLibrary';
import { DownloadButton } from './DownloadButton';

interface Props {
  track: TrackSummary;
  artworkUri: string | null;
  trackNumber?: number;
  isActive?: boolean;
  showDownload?: boolean;
  onPress?: () => void;
  onMenuPress?: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function TrackRow({ track, artworkUri, trackNumber, isActive, showDownload, onPress, onMenuPress }: Props) {
  const titleColor = isActive ? Colors.accent : Colors.text;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      {/* Left: artwork or track number */}
      {artworkUri ? (
        <Image
          source={artworkUri}
          style={styles.artwork}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={styles.trackNumberBox}>
          <Text style={[styles.trackNumber, isActive && styles.trackNumberActive]}>
            {trackNumber ?? '•'}
          </Text>
        </View>
      )}

      {/* Center */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      {/* Right */}
      <View style={styles.right}>
        <Text style={styles.duration}>{formatDuration(track.duration_ms)}</Text>
        {showDownload && <DownloadButton track={track} size={16} />}
        <TouchableOpacity onPress={onMenuPress} hitSlop={12} style={styles.menuBtn}>
          <Text style={styles.menuDots}>•••</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    flexShrink: 0,
  },
  trackNumberBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trackNumber: {
    color: Colors.textMuted,
    fontSize: FontSize.base,
    fontWeight: '600',
  },
  trackNumberActive: {
    color: Colors.accent,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  artist: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  duration: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
  },
  menuBtn: {
    padding: 2,
  },
  menuDots: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    letterSpacing: 1,
  },
});
