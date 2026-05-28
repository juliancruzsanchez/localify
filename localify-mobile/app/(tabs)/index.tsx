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
import { SectionHeader } from '../../components/SectionHeader';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, useLibrarySnapshot, useRecent } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';
import { useStatsStore } from '../../store/statsStore';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const { baseUrl } = useServer();
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting()}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/stats')}
            hitSlop={12}
            style={styles.statsBtn}
          >
            <Ionicons name="stats-chart" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/connect')}
            hitSlop={12}
            style={styles.avatarBtn}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={16} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recently played 2×N grid */}
      {recentLoading || snapshotLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : recentTracks && recentTracks.length > 0 ? (
        <View style={styles.recentGrid}>
          {recentTracks.map((track) => {
            const artwork = artworkUrl(baseUrl, track.id);
            return (
              <TouchableOpacity
                key={track.id}
                style={styles.recentCard}
                onPress={() => playTrack(track, recentTracks)}
                activeOpacity={0.7}
              >
                <Image
                  source={artwork ?? undefined}
                  style={styles.recentArtwork}
                  contentFit="cover"
                  transition={150}
                />
                <Text style={styles.recentTitle} numberOfLines={2}>
                  {track.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Your top tracks (from stats) */}
      {statsTop.length > 0 && (
        <>
          <SectionHeader title="Your top tracks" rightLabel="See all" onRightPress={() => router.push('/stats')} />
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
              <View style={styles.topTrackArtwork}>
                <Image
                  source={artworkUrl(baseUrl, t.id) ?? undefined}
                  style={styles.topTrackArtwork}
                  contentFit="cover"
                  transition={100}
                />
              </View>
              <View style={styles.topTrackInfo}>
                <Text style={styles.topTrackTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.topTrackArtist} numberOfLines={1}>{t.artist}</Text>
              </View>
              <Text style={styles.topTrackCount}>{t.count}×</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

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

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  greeting: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statsBtn: {
    padding: 4,
  },
  avatarBtn: {
    padding: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginBottom: Spacing.md,
  },
  recentCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    gap: Spacing.sm,
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
    paddingRight: Spacing.sm,
  },
  topTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  topTrackArtwork: {
    width: 44,
    height: 44,
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
  horizontalList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bottomPad: {
    height: Spacing.xxl,
  },
});
