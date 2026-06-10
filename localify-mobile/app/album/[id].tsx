import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TrackRow } from '../../components/TrackRow';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, useAlbum } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ARTWORK_SIZE = 220;

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
    heroContainer: {
      alignItems: 'center',
      paddingTop: 100,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
    },
    heroArtwork: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: Radius.md,
      backgroundColor: Colors.surfaceElevated,
      marginBottom: Spacing.md,
    },
    heroTitle: {
      color: Colors.text,
      fontSize: FontSize.xxl,
      fontWeight: '700',
      textAlign: 'center',
    },
    heroArtist: {
      color: Colors.textMuted,
      fontSize: FontSize.md,
      fontWeight: '600',
      marginTop: 2,
    },
    heroMeta: {
      color: Colors.textDim,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      gap: Spacing.lg,
    },
    shuffleBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shuffleIcon: {
      color: Colors.textMuted,
      fontSize: 24,
    },
    playBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: Colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackList: {
      marginTop: Spacing.sm,
    },
    bottomPad: {
      height: Spacing.xxl,
    },
  }), [Colors]);
}

export default function AlbumDetailScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseUrl } = useServer();
  const router = useRouter();
  const { data: album, isLoading, error, fetchStatus } = useAlbum(id ?? '');
  const { playTrack, currentTrack, isPlaying, togglePlayPause } = usePlayerStore();

  const firstTrackArtwork = useMemo(
    () => (album?.tracks[0] ? artworkUrl(baseUrl, album.tracks[0].id) : null),
    [album, baseUrl]
  );

  // While the query is disabled (no baseUrl yet, no id yet) or actively
  // fetching, show the loader instead of the error fallback.
  if (isLoading || fetchStatus === 'fetching' || (!album && !error)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (error || !album) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load album.</Text>
      </View>
    );
  }

  const isCurrentAlbumPlaying =
    currentTrack !== null && album.tracks.some((t) => t.id === currentTrack.id) && isPlaying;

  function handlePlayAll() {
    if (album && album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks);
    }
  }

  function handleToggleShuffle() {
    if (album && album.tracks.length > 0) {
      const shuffled = [...album.tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero with artwork + info */}
      <View style={styles.heroContainer}>
        <Image
          source={firstTrackArtwork ?? undefined}
          style={styles.heroArtwork}
          contentFit="cover"
          transition={200}
        />
        <Text style={styles.heroTitle}>{album.title}</Text>
        <TouchableOpacity onPress={() => router.push(`/artist/${album.artist_id}`)}>
          <Text style={styles.heroArtist}>{album.artist}</Text>
        </TouchableOpacity>
        <Text style={styles.heroMeta}>
          Album{album.year ? ` · ${album.year}` : ''} · {album.track_count} songs
        </Text>
      </View>

      {/* Action row */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.shuffleBtn} onPress={handleToggleShuffle} activeOpacity={0.7}>
          <Text style={styles.shuffleIcon}>⇌</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.playBtn}
          onPress={isCurrentAlbumPlaying ? () => togglePlayPause() : handlePlayAll}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isCurrentAlbumPlaying ? 'pause' : 'play'}
            size={26}
            color={Colors.background}
            style={{ marginLeft: isCurrentAlbumPlaying ? 0 : 3 }}
          />
        </TouchableOpacity>
      </View>

      {/* Track list */}
      <View style={styles.trackList}>
        {album.tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            artworkUri={null}
            trackNumber={track.track_number ?? index + 1}
            isActive={currentTrack?.id === track.id}
            onPress={() => playTrack(track, album.tracks)}
          />
        ))}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}
