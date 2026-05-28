import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DownloadButton } from '../components/DownloadButton';
import { useColors, FontSize, Radius, Spacing } from '../constants/theme';
import { artworkUrl } from '../hooks/useLibrary';
import { useServer } from '../hooks/useServer';
import { usePlayerStore } from '../store/playerStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - Spacing.xl * 2;

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    headerBtn: {
      width: 40,
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    headerContext: {
      color: Colors.textDim,
      fontSize: FontSize.xs,
      fontWeight: '600',
      letterSpacing: 1.2,
    },
    headerTitle: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
    artworkWrapper: {
      alignItems: 'center',
      marginBottom: Spacing.xl,
    },
    artwork: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceElevated,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    infoText: {
      flex: 1,
      gap: 4,
    },
    trackTitle: {
      color: Colors.text,
      fontSize: FontSize.xl,
      fontWeight: '700',
    },
    trackArtist: {
      color: Colors.textMuted,
      fontSize: FontSize.base,
    },
    likeBtn: {
      flexShrink: 0,
      padding: 4,
    },
    likedCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unlikedCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: Colors.textDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrubber: {
      marginBottom: Spacing.lg,
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
      marginTop: 2,
    },
    timeText: {
      color: Colors.textDim,
      fontSize: FontSize.xs,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.xl,
    },
    sideCtrl: {
      width: 44,
      alignItems: 'center',
      position: 'relative',
    },
    skipCtrl: {
      padding: Spacing.xs,
    },
    playBtn: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: Colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activeDot: {
      position: 'absolute',
      bottom: -6,
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: Colors.accent,
    },
    secondaryControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.md,
    },
    secBtn: {
      padding: Spacing.sm,
    },
  }), [Colors]);
}

export default function NowPlayingModal() {
  const styles = useStyles();
  const Colors = useColors();
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
        const newPct = Math.max(0, Math.min(1, scrubStartPct.current + gs.dx / barWidthRef.current));
        setDisplayMs(newPct * durationRef.current);
      },
      onPanResponderRelease: (_e, gs) => {
        const newPct = Math.max(0, Math.min(1, scrubStartPct.current + gs.dx / barWidthRef.current));
        const ms = newPct * durationRef.current;
        setDisplayMs(ms);
        seek(ms);
        isScrubbing.current = false;
      },
      onPanResponderTerminate: () => { isScrubbing.current = false; },
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
  const repeatIcon: 'repeat' | 'repeat-outline' = repeatMode === 'one' ? 'repeat-outline' : 'repeat';
  const repeatActive = repeatMode !== 'none';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={16} style={styles.headerBtn}>
          <Ionicons name="chevron-down" size={28} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerContext}>NOW PLAYING</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentTrack.album}</Text>
        </View>
        <TouchableOpacity hitSlop={16} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Album artwork */}
      <View style={styles.artworkWrapper}>
        <Image
          source={artwork ?? undefined}
          style={styles.artwork}
          contentFit="cover"
          transition={200}
        />
      </View>

      {/* Track info + like */}
      <View style={styles.infoRow}>
        <View style={styles.infoText}>
          <Text style={styles.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleLike(currentTrack.id)}
          hitSlop={12}
          style={styles.likeBtn}
        >
          {isLiked ? (
            <View style={styles.likedCircle}>
              <Ionicons name="checkmark" size={16} color={Colors.background} />
            </View>
          ) : (
            <View style={styles.unlikedCircle}>
              <Ionicons name="add" size={18} color={Colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Progress scrubber */}
      <View style={styles.scrubber}>
        <View
          style={styles.progressHitArea}
          onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width; }}
          {...panResponder.panHandlers}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any }]} />
            <View style={[styles.progressThumb, { left: `${progressPct * 100}%` as any }]} />
          </View>
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayMs)}</Text>
          <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
        </View>
      </View>

      {/* Main controls: shuffle | prev | play | next | repeat */}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => toggleShuffle()} hitSlop={16} style={styles.sideCtrl}>
          <Ionicons
            name="shuffle"
            size={24}
            color={shuffleEnabled ? Colors.accent : Colors.textDim}
          />
          {shuffleEnabled && <View style={styles.activeDot} />}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => playPrevious()} hitSlop={12} style={styles.skipCtrl}>
          <Ionicons name="play-skip-back" size={34} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playBtn} onPress={() => togglePlayPause()} activeOpacity={0.85}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color={Colors.background} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => playNext()} hitSlop={12} style={styles.skipCtrl}>
          <Ionicons name="play-skip-forward" size={34} color={Colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => cycleRepeat()} hitSlop={16} style={styles.sideCtrl}>
          <Ionicons name={repeatIcon} size={24} color={repeatActive ? Colors.accent : Colors.textDim} />
          {repeatActive && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </View>

      {/* Secondary controls */}
      <View style={styles.secondaryControls}>
        <TouchableOpacity hitSlop={12} style={styles.secBtn}>
          <Ionicons name="phone-portrait-outline" size={22} color={Colors.textDim} />
        </TouchableOpacity>
        <DownloadButton track={currentTrack} size={22} />
        <TouchableOpacity hitSlop={12} style={styles.secBtn}>
          <Ionicons name="list-outline" size={24} color={Colors.textDim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
