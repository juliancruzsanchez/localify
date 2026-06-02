import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { useColors, FontSize, Spacing } from '../../constants/theme';
import { artworkUrl, useArtist, useLastFmArtistSimilar, type SimilarArtistInfo } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';

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
    heroBanner: {
      paddingTop: 100,
      paddingBottom: Spacing.xl,
      paddingHorizontal: Spacing.md,
      alignItems: 'center' as const,
      gap: Spacing.sm,
    },
    heroAvatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: Spacing.sm,
    },
    heroInitials: {
      color: Colors.text,
      fontSize: FontSize.xxxl,
      fontWeight: '700' as const,
    },
    artistName: {
      color: Colors.text,
      fontSize: FontSize.xxxl,
      fontWeight: '700' as const,
      textAlign: 'center' as const,
    },
    artistMeta: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
    },
    albumList: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    // Similar artist cards
    similarCard: {
      width: 90,
      marginRight: Spacing.md,
      alignItems: 'center' as const,
      gap: 6,
    },
    similarAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Colors.surfaceElevated,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    similarAvatarDim: {
      opacity: 0.55,
    },
    similarInitials: {
      color: Colors.text,
      fontSize: FontSize.lg,
      fontWeight: '700' as const,
    },
    similarName: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontWeight: '600' as const,
      textAlign: 'center' as const,
    },
    similarBadge: {
      color: Colors.accent,
      fontSize: 10,
      fontWeight: '700' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    bottomPad: {
      height: Spacing.xxl,
    },
  }), [Colors]);
}

// ─── Similar-artist circle card ───────────────────────────────────────────────

function SimilarArtistCard({
  artist,
  onPress,
}: {
  artist: SimilarArtistInfo;
  onPress?: () => void;
}) {
  const styles = useStyles();
  const inLibrary = !!artist.library_artist_id;
  const initials  = artist.name.slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.similarCard}
      onPress={onPress}
      disabled={!inLibrary}
      activeOpacity={inLibrary ? 0.7 : 1}
    >
      <View style={[styles.similarAvatar, !inLibrary && styles.similarAvatarDim]}>
        <Text style={styles.similarInitials}>{initials}</Text>
      </View>
      <Text style={styles.similarName} numberOfLines={2}>
        {artist.name}
      </Text>
      {inLibrary && (
        <Text style={styles.similarBadge}>In library</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ArtistDetailScreen() {
  const styles = useStyles();
  const Colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseUrl } = useServer();
  const router = useRouter();
  const { data: artist, isLoading, error } = useArtist(id ?? '');
  const { data: similar = [] } = useLastFmArtistSimilar(artist?.name ?? '');

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (error || !artist) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load artist.</Text>
      </View>
    );
  }

  const initials = artist.name.slice(0, 2).toUpperCase();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero banner */}
      <LinearGradient
        colors={['#1a237e', Colors.background]}
        style={styles.heroBanner}
      >
        <View style={styles.heroAvatar}>
          <Text style={styles.heroInitials}>{initials}</Text>
        </View>
        <Text style={styles.artistName}>{artist.name}</Text>
        <Text style={styles.artistMeta}>
          {artist.album_count} album{artist.album_count !== 1 ? 's' : ''} · {artist.track_count} songs
        </Text>
      </LinearGradient>

      {/* Albums */}
      {artist.albums.length > 0 ? (
        <>
          <SectionHeader title="Albums" />
          <FlatList
            data={artist.albums}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.albumList}
            renderItem={({ item }) => (
              <AlbumCard
                artworkUri={artworkUrl(baseUrl, item.id)}
                title={item.title}
                subtitle={item.year?.toString()}
                onPress={() => router.push(`/album/${item.id}`)}
              />
            )}
          />
        </>
      ) : null}

      {/* Fans Also Like — populated when streaming server has Last.fm configured */}
      {similar.length > 0 ? (
        <>
          <SectionHeader title="Fans Also Like" />
          <FlatList
            data={similar}
            keyExtractor={(item) => item.name}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.albumList}
            renderItem={({ item }) => (
              <SimilarArtistCard
                artist={item}
                onPress={
                  item.library_artist_id
                    ? () => router.push(`/artist/${item.library_artist_id}`)
                    : undefined
                }
              />
            )}
          />
        </>
      ) : null}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}
