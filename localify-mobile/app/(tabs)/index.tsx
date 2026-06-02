import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlbumCard } from '../../components/AlbumCard';
import { ArtistCard } from '../../components/ArtistCard';
import { SectionHeader } from '../../components/SectionHeader';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
import {
  artworkUrl,
  useLibrarySnapshot,
  useRecent,
  type AlbumSummary,
  type ArtistSummary,
  type TrackSummary,
} from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';
import { useStatsStore } from '../../store/statsStore';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingBottom: Spacing.xxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    greeting: {
      flex: 1,
      color: Colors.text,
      fontSize: FontSize.xxl,
      fontWeight: '800',
    },
    avatarBtn: {
      flexShrink: 0,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loader: {
      marginVertical: Spacing.xl,
    },
    recentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
    },
    recentCard: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.surfaceElevated,
      borderRadius: Radius.sm,
      overflow: 'hidden',
    },
    recentArtwork: {
      width: 56,
      height: 56,
      flexShrink: 0,
      backgroundColor: Colors.surface,
    },
    recentTitle: {
      flex: 1,
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '600',
      paddingHorizontal: 10,
    },
    horizontalList: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    emptyRecent: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      color: Colors.textMuted,
      fontSize: FontSize.sm,
    },
  }), [Colors]);
}

// ─── Most-played card (uses local stats history, looks like desktop card) ─────

function MostPlayedCard({
  trackId,
  title,
  artist,
  artworkUri,
  onPress,
}: {
  trackId: string;
  title: string;
  artist: string;
  artworkUri: string | null;
  onPress: () => void;
}) {
  // Reuse AlbumCard layout — square art + title + subtitle
  return (
    <AlbumCard
      artworkUri={artworkUri}
      title={title}
      subtitle={artist}
      onPress={onPress}
      key={trackId}
    />
  );
}

// ─── Home screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const { baseUrl } = useServer();
  const { data: recentTracks, isLoading: recentLoading } = useRecent(6);
  const { data: snapshot, isLoading: snapshotLoading } = useLibrarySnapshot();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const statsHistory = useStatsStore((s) => s.history);

  const tracksById = useMemo(() => {
    const m = new Map<string, TrackSummary>();
    for (const t of snapshot?.tracks ?? []) m.set(t.id, t);
    return m;
  }, [snapshot]);

  // Map each artist_id to one of their album_ids for circle artwork.
  const artistRepAlbum = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of snapshot?.albums ?? []) {
      if (!m.has(a.artist_id)) m.set(a.artist_id, a.id);
    }
    return m;
  }, [snapshot]);

  const topAlbums: AlbumSummary[] = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.albums]
      .sort((a, b) => b.track_count - a.track_count)
      .slice(0, 8);
  }, [snapshot]);

  const topArtists: ArtistSummary[] = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.artists]
      .sort((a, b) => b.track_count - a.track_count)
      .slice(0, 8);
  }, [snapshot]);

  const mostPlayed = useMemo(() => {
    const counts: Record<string, { id: string; title: string; artist: string; count: number }> = {};
    for (const e of statsHistory) {
      if (!counts[e.trackId]) counts[e.trackId] = { id: e.trackId, title: e.title, artist: e.artist, count: 0 };
      counts[e.trackId].count++;
    }
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [statsHistory]);

  const isLoading = recentLoading || snapshotLoading;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header: greeting + avatar */}
      <View style={styles.header}>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting()}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.7}
          style={styles.avatarBtn}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={18} color={Colors.text} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Recent pill grid (2-column) — recently played tracks */}
      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : recentTracks && recentTracks.length > 0 ? (
        <View style={styles.recentGrid}>
          {recentTracks.slice(0, 6).map((track) => (
            <TouchableOpacity
              key={track.id}
              style={styles.recentCard}
              onPress={() => playTrack(track, recentTracks)}
              activeOpacity={0.75}
            >
              <Image
                source={artworkUrl(baseUrl, track.id) ?? undefined}
                style={styles.recentArtwork}
                contentFit="cover"
                transition={150}
              />
              <Text style={styles.recentTitle} numberOfLines={2}>
                {track.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyRecent}>
          Play some music to see your recent history here.
        </Text>
      )}

      {/* Most Played (from local stats) */}
      {mostPlayed.length > 0 ? (
        <>
          <SectionHeader title="Most Played" />
          <FlatList
            data={mostPlayed}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <MostPlayedCard
                trackId={item.id}
                title={item.title}
                artist={item.artist}
                artworkUri={artworkUrl(baseUrl, item.id)}
                onPress={() => {
                  const track = tracksById.get(item.id);
                  if (track) playTrack(track, snapshot?.tracks ?? [track]);
                }}
              />
            )}
          />
        </>
      ) : null}

      {/* Top Albums */}
      {topAlbums.length > 0 ? (
        <>
          <SectionHeader
            title="Top Albums"
            rightLabel="See all"
            onRightPress={() => router.push('/(tabs)/library')}
          />
          <FlatList
            data={topAlbums}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => (
              <AlbumCard
                artworkUri={artworkUrl(baseUrl, item.id)}
                title={item.title}
                subtitle={item.artist}
                onPress={() => router.push(`/album/${item.id}`)}
              />
            )}
          />
        </>
      ) : null}

      {/* Top Artists */}
      {topArtists.length > 0 ? (
        <>
          <SectionHeader
            title="Top Artists"
            rightLabel="See all"
            onRightPress={() => router.push('/(tabs)/library')}
          />
          <FlatList
            data={topArtists}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => {
              const albumId = artistRepAlbum.get(item.id);
              return (
                <ArtistCard
                  artworkUri={albumId ? artworkUrl(baseUrl, albumId) : null}
                  name={item.name}
                  onPress={() => router.push(`/artist/${item.id}`)}
                />
              );
            }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}
