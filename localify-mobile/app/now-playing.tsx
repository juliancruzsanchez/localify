import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DownloadButton } from '../components/DownloadButton';
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
    seek,
    shuffleEnabled,
    repeatMode,
    toggleShuffle,
    cycleRepeat,
    likedTrackIds,
    toggleLike,
  } = usePlayerStore();

  // ── Scrubbing ──────────────────────────────────────────────────────────────

  const barWidthRef = useRef(1);
  const isScrubbing = useRef(false);
  const scrubStartPct = useRef(0);
  const durationRef = useRef(durationMs);
  const [displayMs, setDisplayMs] = useState(positionMs);

  useEffect(() => { durationRef.current = durationMs; }, [durationMs]);

  useEffect(() => {
    if (!isScrubbing.current) setDisplayMs(positionMs);
  }, [positionMs]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        isScrubbing.current = true;
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidthRef.current));
        scrubStartPct.current = pct;
        setDisplayMs(pct * durationRef.current);
      },
      onPanResponderMove: (_e, gs) => {
        const deltaPct = gs.dx / barWidthRef.current;
        const newPct = Math.max(0, Math.min(1, scrubStartPct.current + deltaPct));
        setDisplayMs(newPct * durationRef.current);
      },
      onPanResponderRelease: (_e, gs) => {
        const deltaPct = gs.dx / barWidthRef.current;
        const newPct = Math.max(0, Math.min(1, scrubStartPct.current + deltaPct));
        const ms = newPct * durationRef.current;
        setDisplayMs(ms);
        seek(ms);
        isScrubbing.current = false;
      },
      onPanResponderTerminate: () => {
        isScrubbing.current = false;
      },
    })
  ).current;

  // ──────────────────────────────────────────────────────────────────────────

  if (!currentTrack) {
    router.back();
    return null;
  }

  const artwork = artworkUrl(baseUrl, currentTrack.id);
  const progressPct = durationMs > 0 ? displayMs / durationMs : 0;
  const isLiked = !!likedTrackIds[currentTrack.id];

  const repeatIcon = repeatMode === 'one' ? 'repeat-outline' : 'repeat';
  const repeatColor = repeatMode === 'none' ? Colors.textDim : Colors.accent;

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

      {/* Track info + like */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleLike(currentTrack.id)}
          hitSlop={12}
          style={styles.likeBtn}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={26}
            color={isLiked ? Colors.accent : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Progress scrubber */}
      <View style={styles.progressContainer}>
        <View
          style={styles.progressHitArea}
          onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width; }}
          {...panResponder.panHandlers}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any }]} />
            <View
              style={[
                styles.progressThumb,
                { left: `${progressPct * 100}%` as any },
              ]}
            />
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Main controls */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => playPrevious()} hitSlop={16} style={styles.ctrlBtn}>
          <Ionicons name="play-skip-back" size={32} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={() => togglePlayPause()} activeOpacity={0.8}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={Colors.background} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => playNext()} hitSlop={16} style={styles.ctrlBtn}>
          <Ionicons name="play-skip-forward" size={32} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Secondary controls: shuffle, download, repeat */}
      <View style={styles.secondaryControls}>
        <TouchableOpacity onPress={() => toggleShuffle()} hitSlop={12} style={styles.secBtn}>
          <Ionicons
            name="shuffle"
            size={22}
            color={shuffleEnabled ? Colors.accent : Colors.textDim}
          />
        </TouchableOpacity>

        <DownloadButton track={currentTrack} size={20} />

        <TouchableOpacity onPress={() => cycleRepeat()} hitSlop={12} style={styles.secBtn}>
          <Ionicons name={repeatIcon} size={22} color={repeatColor} />
          {repeatMode === 'one' && (
            <View style={styles.repeatOneDot} />
          )}
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
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.lg,
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
  likeBtn: {
    padding: Spacing.sm,
  },
  progressContainer: {
    width: '100%',
    marginBottom: Spacing.xl,
  },
  progressHitArea: {
    paddingVertical: 12,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.text,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.text,
    top: -5,
    marginLeft: -7,
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
    marginBottom: Spacing.xl,
  },
  ctrlBtn: {
    padding: Spacing.sm,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Spacing.md,
  },
  secBtn: {
    padding: Spacing.sm,
    position: 'relative',
  },
  repeatOneDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
  },
});
