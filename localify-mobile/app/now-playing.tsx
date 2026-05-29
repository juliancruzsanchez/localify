import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { artworkUrl } from '../hooks/useLibrary';
import { useServer } from '../hooks/useServer';
import { useLyrics, useCurrentLyricIndex, useArtworkColor } from '../hooks/useLyrics';
import { usePlayerStore } from '../store/playerStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ARTWORK_SIZE = SCREEN_WIDTH - Spacing.xl * 2;
// Compact artwork when lyrics are available
const ARTWORK_SIZE_COMPACT = SCREEN_WIDTH * 0.45;

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

  const { lines } = useLyrics(currentTrack?.id, baseUrl);
  const currentIndex = useCurrentLyricIndex(lines, positionMs);
  const bgColor = useArtworkColor(currentTrack?.id, baseUrl);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const lineRefs = useRef<(View | null)[]>([]);

  // Auto-scroll lyrics to the current line
  useEffect(() => {
    if (currentIndex < 0 || !lyricsScrollRef.current) return;
    const ref = lineRefs.current[currentIndex];
    if (ref) {
      (ref as any).measureLayout?.(
        lyricsScrollRef.current,
        (_x: number, y: number) => {
          lyricsScrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
        },
        () => {},
      );
    }
  }, [currentIndex]);

  if (!currentTrack) {
    router.back();
    return null;
  }

  const artwork = artworkUrl(baseUrl, currentTrack.id);
  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const hasLyrics = lines && lines.length > 0;
  const artSize = hasLyrics ? ARTWORK_SIZE_COMPACT : ARTWORK_SIZE;

  return (
    <LinearGradient
      colors={[bgColor, '#0d0d0d', '#0d0d0d']}
      locations={[0, 0.55, 1]}
      style={styles.container}
    >
      {/* Dismiss handle */}
      <View style={styles.handle} />

      {/* Artwork */}
      <Image
        source={artwork ?? undefined}
        style={[styles.artwork, { width: artSize, height: artSize }]}
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

      {/* Controls */}
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

      {/* Lyrics */}
      {hasLyrics && (
        <View style={styles.lyricsContainer}>
          <ScrollView
            ref={lyricsScrollRef}
            style={styles.lyricsScroll}
            showsVerticalScrollIndicator={false}
          >
            {lines!.map((line, i) => {
              const isCurrent = i === currentIndex;
              const isPast = i < currentIndex;
              return (
                <View
                  key={i}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  style={styles.lyricLine}
                >
                  <Text
                    style={[
                      styles.lyricText,
                      isCurrent && styles.lyricCurrent,
                      isPast && styles.lyricPast,
                    ]}
                  >
                    {line.text}
                  </Text>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: Spacing.lg,
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
  lyricsContainer: {
    flex: 1,
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.md,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricLine: {
    marginBottom: Spacing.md,
  },
  lyricText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: FontSize.lg,
    fontWeight: '600',
    lineHeight: FontSize.lg * 1.4,
  },
  lyricCurrent: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  lyricPast: {
    color: 'rgba(255,255,255,0.25)',
  },
});
