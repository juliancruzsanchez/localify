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
import { artworkUrl, useAlbums, useRecent } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';

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
  const { data: albums, isLoading: albumsLoading } = useAlbums();
  const playTrack = usePlayerStore((s) => s.playTrack);

  const jumpBackIn = useMemo(() => albums?.slice(0, 10) ?? [], [albums]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting()}</Text>
      </View>

      {/* Recently played 2×N grid */}
      {recentLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : recentTracks && recentTracks.length > 0 ? (
        <>
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
        </>
      ) : null}

      {/* Jump back in */}
      {albumsLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : jumpBackIn.length > 0 ? (
        <>
          <SectionHeader title="Jump back in" />
          <FlatList
            data={jumpBackIn}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => {
              const artwork = artworkUrl(baseUrl, item.id);
              return (
                <AlbumCard
                  artworkUri={artwork}
                  title={item.title}
                  subtitle={item.artist}
                  onPress={() => router.push(`/album/${item.id}`)}
                />
              );
            }}
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  greeting: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
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
  horizontalList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bottomPad: {
    height: Spacing.xxl,
  },
});
