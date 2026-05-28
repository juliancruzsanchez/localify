import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { useServerStats } from '../hooks/useLibrary';
import { useStatsStore } from '../store/statsStore';

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const { topTracks, topArtists, todayMs, weekMs, allTimeMs, todayCount, history } = useStatsStore();
  const { data: serverStats, isLoading: serverLoading } = useServerStats();

  const tracks  = topTracks(10);
  const artists = topArtists(8);
  const todayMsVal  = todayMs();
  const weekMsVal   = weekMs();
  const allTimeMsVal = allTimeMs();
  const playsToday  = todayCount();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Stats</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Overview cards */}
      <View style={styles.cardRow}>
        <StatCard label="Today" value={formatMs(todayMsVal)} sub={`${playsToday} plays`} />
        <StatCard label="This week" value={formatMs(weekMsVal)} />
        <StatCard label="All time" value={formatMs(allTimeMsVal)} sub={`${history.length} plays`} />
      </View>

      {/* Top tracks */}
      {tracks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Tracks</Text>
          {tracks.map((t, i) => (
            <View key={t.id} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.rowMeta}>{t.artist}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowCount}>{t.count}×</Text>
                {t.ms > 0 && <Text style={styles.rowTime}>{formatMs(t.ms)}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top artists */}
      {artists.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Artists</Text>
          {artists.map((a, i) => (
            <View key={a.artist} style={styles.row}>
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>{a.artist}</Text>
                <Text style={styles.rowMeta}>{a.count} plays</Text>
              </View>
              {a.ms > 0 && <Text style={styles.rowTime}>{formatMs(a.ms)}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Server-side stats (all sources combined) */}
      {serverLoading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginVertical: Spacing.md }} />
      ) : serverStats ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All-time (all devices)</Text>

          <View style={[styles.cardRow, { paddingHorizontal: Spacing.md }]}>
            <StatCard
              label="Total plays"
              value={serverStats.total_plays.toLocaleString()}
              sub={`${serverStats.unique_tracks} unique tracks`}
            />
            <StatCard
              label="Listened"
              value={formatMs(serverStats.total_listen_ms)}
              sub={`${serverStats.unique_artists} artists`}
            />
          </View>

          {serverStats.top_tracks.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: Spacing.md }]}>
                Top tracks (server)
              </Text>
              {serverStats.top_tracks.slice(0, 5).map((t, i) => (
                <View key={t.id} style={styles.row}>
                  <Text style={styles.rank}>{i + 1}</Text>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{t.name}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowCount}>{t.count}×</Text>
                    {t.ms > 0 && <Text style={styles.rowTime}>{formatMs(t.ms)}</Text>}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      ) : null}

      {/* Empty state */}
      {history.length === 0 && !serverStats && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No stats yet</Text>
          <Text style={styles.emptySub}>Start playing music to see your listening stats here.</Text>
        </View>
      )}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backIcon: {
    color: Colors.text,
    fontSize: 32,
    lineHeight: 36,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.accent,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
    textAlign: 'center',
  },
  statSub: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
    marginTop: 1,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  rank: {
    color: Colors.textDim,
    fontSize: FontSize.md,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  rowMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowCount: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  rowTime: {
    color: Colors.textDim,
    fontSize: FontSize.xs,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
