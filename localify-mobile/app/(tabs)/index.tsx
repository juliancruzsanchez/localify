import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { SectionHeader } from '../../components/SectionHeader';
import { useColors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, useLibrarySnapshot, useRecent } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';
import { useStatsStore } from '../../store/statsStore';

type FilterId = 'all' | 'music';
const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'music', label: 'Music' },
];

function useStyles() {
  const Colors = useColors();
  return useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.background,
    },
    content: {
      paddingTop: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    avatarBtn: {
      flexShrink: 0,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'center',
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: Radius.full,
      backgroundColor: Colors.surfaceElevated,
    },
    filterChipActive: {
      backgroundColor: Colors.accent,
    },
    filterChipText: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: Colors.background,
    },
    loader: {
      marginVertical: Spacing.xl,
    },
    recentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      marginTop: Spacing.sm,
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
      gap: Spacing.md,
    },
    topTrackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.md,
    },
    topTrackArtwork: {
      width: 48,
      height: 48,
      borderRadius: Radius.sm,
      backgroundColor: Colors.surfaceElevated,
      flexShrink: 0,
      overflow: 'hidden',
    },
    topTrackInfo: {
      flex: 1,
      gap: 2,
    },
    topTrackTitle: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontWeight: '500',
    },
    topTrackArtist: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
    },
    topTrackCount: {
      color: Colors.accent,
      fontSize: FontSize.sm,
      fontWeight: '700',
    },
  }), [Colors]);
}

export default function HomeScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const router = useRouter();
  const { baseUrl } = useServer();
  const [filter, setFilter] = useState<FilterId>('all');
  const { data: recentTracks, isLoading: recentLoading } = useRecent(8);
  const { data: snapshot, isLoading: snapshotLoading } = useLibrarySnapshot();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const statsHistory = useStatsStore((s) => s.history);

  const jumpBackIn = useMemo(() => snapshot?.albums?.slice(0, 12) ?? [], [snapshot]);

  const statsTop = useMemo(() => {
    const counts: Record<string, { id: string; title: string; artist: string; count: number; ms: number }> = {};
    for (const e of statsHistory) {
      if (!counts[e.trackId]) counts[e.trackId] = { id: e.trackId, title: e.title, artist: e.artist, count: 0, ms: 0 };
      counts[e.trackId].count++;
      counts[e.trackId].ms += e.listenedMs;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [statsHistory]);

  const isLoading = recentLoading || snapshotLoading;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header: avatar + filter chips */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.7}
          style={styles.avatarBtn}
        >
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={Colors.text} />
          </View>
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Compact 2-column recent grid */}
      {isLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : recentTracks && recentTracks.length > 0 ? (
        <View style={styles.recentGrid}>
          {recentTracks.slice(0, 8).map((track) => (
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
      ) : null}

      {/* Jump back in */}
      {jumpBackIn.length > 0 ? (
        <>
          <SectionHeader title="Jump back in" />
          <FlatList
            data={jumpBackIn}
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

      {/* Your top tracks (from local stats) */}
      {statsTop.length > 0 && (
        <>
          <SectionHeader
            title="Your top tracks"
            rightLabel="See all"
            onRightPress={() => router.push('/stats')}
          />
          {statsTop.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.topTrackRow}
              onPress={() => {
                const track = snapshot?.tracks.find((tr) => tr.id === t.id);
                if (track) playTrack(track, snapshot?.tracks);
              }}
              activeOpacity={0.7}
            >
              <Image
                source={artworkUrl(baseUrl, t.id) ?? undefined}
                style={styles.topTrackArtwork}
                contentFit="cover"
                transition={100}
              />
              <View style={styles.topTrackInfo}>
                <Text style={styles.topTrackTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.topTrackArtist} numberOfLines={1}>{t.artist}</Text>
              </View>
              <Text style={styles.topTrackCount}>{t.count}×</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}
