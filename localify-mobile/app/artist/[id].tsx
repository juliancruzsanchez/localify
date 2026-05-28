import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
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
import { artworkUrl, useArtist } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { baseUrl } = useServer();
  const router = useRouter();
  const { data: artist, isLoading, error } = useArtist(id ?? '');

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

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  heroInitials: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '700',
  },
  artistName: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  artistMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  albumList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bottomPad: {
    height: Spacing.xxl,
  },
});
