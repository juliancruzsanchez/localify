import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TrackRow } from '../../components/TrackRow';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, usePlaylist } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.background,
    },
    errorText: {
      color: Colors.textMuted,
      fontSize: FontSize.base,
    },
    header: {
      paddingTop: 100,
      paddingBottom: Spacing.xl,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    playlistIconContainer: {
      width: 120,
      height: 120,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
      marginBottom: Spacing.sm,
    },
    playlistIcon: {
      fontSize: 56,
    },
    playlistName: {
      color: Colors.text,
      fontSize: FontSize.xxl,
      fontWeight: '700',
      textAlign: 'center',
    },
    playlistMeta: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    playBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playIcon: {
      color: Colors.background,
      fontSize: FontSize.xl,
      marginLeft: 3,
    },
    bottomPad: {
      height: Spacing.xxl,
    },
  }), [Colors]);
}

export default function PlaylistDetailScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseUrl } = useServer();
  const { data: playlist, isLoading, error } = usePlaylist(id ?? '');
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayerStore();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (error || !playlist) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load playlist.</Text>
      </View>
    );
  }

  const isCurrentPlaylistPlaying =
    currentTrack !== null &&
    playlist.tracks.some((t) => t.id === currentTrack.id) &&
    isPlaying;

  function handlePlayAll() {
    if (playlist && playlist.tracks.length > 0) {
      playTrack(playlist.tracks[0], playlist.tracks);
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.playlistIconContainer}>
          <Text style={styles.playlistIcon}>📋</Text>
        </View>
        <Text style={styles.playlistName}>{playlist.name}</Text>
        <Text style={styles.playlistMeta}>{playlist.track_count} songs</Text>
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={isCurrentPlaylistPlaying ? () => togglePlayPause() : handlePlayAll}
          activeOpacity={0.8}
        >
          <Text style={styles.playIcon}>{isCurrentPlaylistPlaying ? '⏸' : '▶'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tracks */}
      {playlist.tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          artworkUri={artworkUrl(baseUrl, track.id)}
          isActive={currentTrack?.id === track.id}
          onPress={() => playTrack(track, playlist.tracks)}
        />
      ))}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}
