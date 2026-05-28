import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlbumCard } from '../../components/AlbumCard';
import { SectionHeader } from '../../components/SectionHeader';
import { TrackRow } from '../../components/TrackRow';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { artworkUrl, useSearch } from '../../hooks/useLibrary';
import { useServer } from '../../hooks/useServer';
import { usePlayerStore } from '../../store/playerStore';

interface CategoryCard {
  id: string;
  label: string;
  color: string;
  emoji: string;
}

const CATEGORIES: CategoryCard[] = [
  { id: 'songs', label: 'Songs', color: '#7c3aed', emoji: '🎵' },
  { id: 'albums', label: 'Albums', color: '#1d4ed8', emoji: '💿' },
  { id: 'artists', label: 'Artists', color: '#ea580c', emoji: '🎤' },
  { id: 'playlists', label: 'Playlists', color: '#15803d', emoji: '📋' },
];

export default function SearchScreen() {
  const router = useRouter();
  const { baseUrl } = useServer();
  const [query, setQuery] = useState('');
  const playTrack = usePlayerStore((s) => s.playTrack);

  const { data: results, isLoading } = useSearch(query);

  const showBrowse = query.length <= 1;

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>

        {/* Search bar — matches desktop pill style */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to play?"
            placeholderTextColor={Colors.textDim}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      </View>

      {/* Browse section */}
      {showBrowse ? (
        <>
          <SectionHeader title="Browse" />
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, { backgroundColor: cat.color }]}
                onPress={() => router.push('/(tabs)/library')}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {/* Search results */}
      {!showBrowse && isLoading ? (
        <ActivityIndicator color={Colors.accent} style={styles.loader} />
      ) : null}

      {!showBrowse && results ? (
        <>
          {/* Tracks */}
          {results.tracks.length > 0 ? (
            <>
              <SectionHeader title="Songs" />
              {results.tracks.slice(0, 5).map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  artworkUri={artworkUrl(baseUrl, track.id)}
                  onPress={() => playTrack(track, results.tracks)}
                />
              ))}
            </>
          ) : null}

          {/* Albums */}
          {results.albums.length > 0 ? (
            <>
              <SectionHeader title="Albums" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {results.albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    artworkUri={artworkUrl(baseUrl, album.id)}
                    title={album.title}
                    subtitle={album.artist}
                    onPress={() => router.push(`/album/${album.id}`)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Artists */}
          {results.artists.length > 0 ? (
            <>
              <SectionHeader title="Artists" />
              {results.artists.slice(0, 5).map((artist) => (
                <TouchableOpacity
                  key={artist.id}
                  style={styles.artistRow}
                  onPress={() => router.push(`/artist/${artist.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.artistAvatar}>
                    <Text style={styles.artistInitials}>
                      {artist.name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.artistInfo}>
                    <Text style={styles.artistName}>{artist.name}</Text>
                    <Text style={styles.artistMeta}>Artist</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          {results.tracks.length === 0 &&
          results.albums.length === 0 &&
          results.artists.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No results for "{query}"</Text>
            </View>
          ) : null}
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
  header: {
    paddingTop: 56,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
    padding: 0,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  categoryCard: {
    width: '48%',
    height: 100,
    borderRadius: Radius.md,
    padding: Spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryLabel: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  horizontalList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistInitials: {
    color: Colors.text,
    fontSize: FontSize.base,
    fontWeight: '700',
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  artistMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.base,
  },
  bottomPad: {
    height: Spacing.xxl,
  },
});
